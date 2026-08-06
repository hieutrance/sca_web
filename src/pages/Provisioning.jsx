import React, { useState } from 'react';
import { Wrench, Usb, Car, ShieldCheck } from 'lucide-react';

export default function Provisioning() {
  const [formData, setFormData] = useState({
    car_id: '',
    license_plate: '',
    car_model: '',
    seats: '5',
    color: 'Trắng',
  });
  
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const colors = [
    { name: 'Trắng', hex: '#f8fafc' },
    { name: 'Đen', hex: '#0f172a' },
    { name: 'Đỏ', hex: '#ef4444' },
    { name: 'Bạc', hex: '#94a3b8' },
    { name: 'Xanh', hex: '#3b82f6' },
  ];

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleColorSelect = (colorName) => {
    setFormData({ ...formData, color: colorName });
  };

  // Các hàm tiện ích hỗ trợ đọc Serial (Giữ nguyên logic cực xịn của bạn)
  const waitForMarker = async (reader, marker, timeoutMs) => {
    let buffer = "";
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ value: undefined, done: false }), remaining))
      ]);
      if (done) break;
      if (value) {
        buffer += value;
        if (buffer.includes(marker)) {
          const idx = buffer.indexOf(marker) + marker.length;
          return { found: true, leftover: buffer.substring(idx) };
        }
      }
    }
    return { found: false, leftover: buffer };
  };

  const readResponseWithTimeout = async (reader, timeoutMs, initialBuffer = "") => {
    let buffer = initialBuffer;
    if (buffer.includes("SUCCESS") || buffer.includes("ERROR:")) return buffer.trim();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ value: undefined, done: false }), remaining))
      ]);
      if (done) break;
      if (value) {
        buffer += value;
        if (buffer.includes("SUCCESS") || buffer.includes("ERROR:")) return buffer.trim();
      }
    }
    return buffer.trim();
  };

  // HÀM CHÍNH: KẾT NỐI USB -> NẠP ESP32 -> GỌI API PYTHON
  const handleUSBProvisioning = async () => {
    if (!("serial" in navigator)) {
      setMessage({ type: 'error', text: "Trình duyệt không hỗ trợ Web Serial. Vui lòng dùng Chrome/Edge." });
      return;
    }

    if (!formData.car_id || !formData.car_model || !formData.license_plate) {
      setMessage({ type: 'error', text: "Vui lòng nhập đầy đủ thông tin xe!" });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: 'info', text: "Đang kết nối USB..." });

    const randomKey = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const jsonPayload = JSON.stringify({
      car_id: formData.car_id,
      license_plate: formData.license_plate,
      car_model: formData.car_model,
      key_root: randomKey
    });
    const payload = `PROVISION:${jsonPayload}\n`;

    let port;
    let reader;
    let successUSB = false;

    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      reader = textDecoder.readable.getReader();

      setMessage({ type: 'info', text: "Đang chờ board ESP32 khởi động..." });
      const bootLog = await waitForMarker(reader, "KEYFOB START", 10000);

      if (!bootLog.found) {
        throw new Error("Không thấy tín hiệu khởi động từ ESP32 (Không thấy KEYFOB START).");
      }

      setMessage({ type: 'info', text: "Đang truyền dữ liệu xuống ESP32..." });
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      await writer.write(payload);
      await writer.close();

      setMessage({ type: 'info', text: "Đang chờ ESP32 xác nhận..." });
      const response = await readResponseWithTimeout(reader, 5000, bootLog.leftover);

      if (response.includes("SUCCESS")) {
        successUSB = true;
      } else if (response.includes("ERROR:")) {
        throw new Error("Keyfob TỪ CHỐI dữ liệu: " + response);
      } else {
        throw new Error("Không nhận được phản hồi rõ ràng từ Keyfob (Timeout).");
      }

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: "Lỗi USB: " + error.message });
    } finally {
      if (reader) try { reader.releaseLock(); } catch (e) {}
      if (port) try { await port.close(); } catch (e) {}
    }

    if (successUSB) {
      setMessage({ type: 'info', text: "Nạp ESP32 thành công! Đang mã hóa lên Cloud..." });
      try {
        // NHỚ SỬA LẠI THÀNH LINK RENDER CỦA BẠN NẾU ĐÃ ĐƯA PYTHON LÊN MẠNG
        const apiUrl = 'https://sca-backend-od11.onrender.com/'; 
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, key_root: randomKey })
        });

        const result = await response.json();
        
        if (response.ok) {
          setMessage({ type: 'success', text: "Hoàn tất! " + result.message });
          setFormData({ car_id: '', license_plate: '', car_model: '', seats: '5', color: 'Trắng' });
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
         setMessage({ type: 'error', text: "Lỗi Cloud API: " + error.message });
      }
    }
    
    setIsProcessing(false);
  };

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300 bg-gray-50/50">
      {/* HEADER GIỐNG CÁC TRANG KHÁC */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1 flex items-center gap-2">
            <Wrench className="text-blue-600" size={28} /> Cấp Phát Khóa Phương Tiện
          </h2>
          <p className="text-sm text-gray-500">Khởi tạo thông tin và nạp mã khóa an toàn trực tiếp xuống phần cứng (Web Serial).</p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100 flex items-center gap-2 shadow-sm">
          <ShieldCheck size={18} className="text-blue-600" /> Hệ thống mã hóa sẵn sàng
        </div>
      </div>

      {/* THÔNG BÁO LỖI/THÀNH CÔNG (Full width) */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2
          ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 
            message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
            'bg-blue-50 text-blue-700 border-blue-200'}`}
        >
          {message.type === 'success' && <ShieldCheck size={20} />}
          {message.type === 'info' && <span className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></span>}
          {message.text}
        </div>
      )}

      {/* FORM NHẬP LIỆU (Trải rộng màn hình, chia cột) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 lg:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Cột 1 */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mã định danh xe (Car ID)</label>
                <input 
                  type="text" 
                  name="car_id" 
                  value={formData.car_id} 
                  onChange={handleInputChange} 
                  placeholder="VD: car_05" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dòng xe (Model)</label>
                <div className="relative">
                  <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    name="car_model" 
                    value={formData.car_model} 
                    onChange={handleInputChange} 
                    placeholder="VD: VinFast VF8" 
                    className="w-full border border-gray-300 rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors" 
                  />
                </div>
              </div>
            </div>

            {/* Cột 2 */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Biển số xe</label>
                <input 
                  type="text" 
                  name="license_plate" 
                  value={formData.license_plate} 
                  onChange={handleInputChange} 
                  placeholder="VD: 51H-123.45" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors font-mono" 
                />
              </div>

              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Chỗ ngồi</label>
                  <select 
                    name="seats" 
                    value={formData.seats} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors"
                  >
                    <option value="4">4 chỗ</option>
                    <option value="5">5 chỗ</option>
                    <option value="7">7 chỗ</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Màu sơn: <span className="text-blue-600">{formData.color}</span></label>
                  <div className="flex items-center gap-3 h-[46px]">
                    {colors.map(c => (
                      <button 
                        key={c.name}
                        onClick={() => handleColorSelect(c.name)}
                        className={`w-8 h-8 rounded-full border border-gray-300 shadow-sm transition-all ${formData.color === c.name ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                        type="button"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <hr className="my-8 border-gray-100" />

          {/* VÙNG NÚT BẤM */}
          <div className="flex flex-col items-center justify-center">
            <button 
              onClick={handleUSBProvisioning} 
              disabled={isProcessing}
              className="w-full max-w-md py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 text-base"
            >
              {isProcessing ? (
                <>
                  <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                  Đang ghi dữ liệu xuống chip...
                </>
              ) : (
                <>
                  <Usb size={22} />CẤP PHÁT KHÓA 
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Lưu ý: Chỉ hỗ trợ trên trình duyệt Google Chrome hoặc Microsoft Edge. <br/>Vui lòng đảm bảo cáp USB có hỗ trợ truyền dữ liệu.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}