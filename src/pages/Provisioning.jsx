import React, { useState, useEffect } from 'react';
import { Wrench, Usb, Car, Key, CreditCard, Scan, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { db } from '../services/firebase';

// Khóa Master 32 bytes đồng nhất với hệ thống để mã hóa key_root
const MASTER_KEY_STR = "MySuperSecretMasterKey32Bytes!!!";

export default function Provisioning() {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [vehicles, setVehicles] = useState({});
  const [nfcWhitelist, setNfcWhitelist] = useState({});
  
  // --- STATE BIỂU MẪU CẤP PHÁT XE & KEY FOB ---
  const [formData, setFormData] = useState({
    car_id: '',
    license_plate: '',
    car_model: '',
    seats: '5',
    color: 'Trắng',
  });

  // --- STATE BIỂU MẪU CẤP THẺ NFC ---
  const [nfcCarId, setNfcCarId] = useState('');

  // --- STATE TIẾN TRÌNH & THÔNG BÁO ---
  const [statusMessage, setStatusMessage] = useState(null);
  const [isProcessingFob, setIsProcessingFob] = useState(false);
  const [isProcessingNfc, setIsProcessingNfc] = useState(false);

  const colors = [
    { name: 'Trắng', hex: '#f8fafc' },
    { name: 'Đen', hex: '#0f172a' },
    { name: 'Đỏ', hex: '#ef4444' },
    { name: 'Bạc', hex: '#94a3b8' },
    { name: 'Xanh', hex: '#3b82f6' },
  ];

  // 1. LẮNG NGHE DỮ LIỆU THỜI GIAN THỰC TỪ FIREBASE
  useEffect(() => {
    const vehiclesRef = ref(db, 'Vehicles');
    const nfcRef = ref(db, 'NfcWhitelist');

    const unsubVehicles = onValue(vehiclesRef, (snapshot) => {
      setVehicles(snapshot.val() || {});
    });

    const unsubNfc = onValue(nfcRef, (snapshot) => {
      setNfcWhitelist(snapshot.val() || {});
    });

    return () => {
      unsubVehicles();
      unsubNfc();
    };
  }, []);

  // 2. CÁC HÀM XỬ LÝ NỐI TIẾP WEB SERIAL API
  const readResponseWithTimeout = async (reader, timeoutMs) => {
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
        if (buffer.includes("SUCCESS") || buffer.includes("ERROR:")) return buffer.trim();
      }
    }
    return buffer.trim();
  };

  const readCarIdWithTimeout = async (reader, timeoutMs) => {
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
        const idx = buffer.indexOf("CAR_ID:");
        if (idx !== -1) {
          const rest = buffer.substring(idx + "CAR_ID:".length);
          const newlineIdx = rest.indexOf("\n");
          if (newlineIdx !== -1) return rest.substring(0, newlineIdx).trim();
        }
      }
    }
    return null;
  };

  const waitForUidDetected = async (reader, timeoutMs) => {
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
        const idx = buffer.indexOf("UID_DETECTED:");
        if (idx !== -1) {
          const rest = buffer.substring(idx + "UID_DETECTED:".length);
          const newlineIdx = rest.indexOf("\n");
          if (newlineIdx !== -1) return rest.substring(0, newlineIdx).trim();
        }
      }
    }
    return null;
  };

  // 3. MÃ HÓA AES-256-CTR BẰNG WEB CRYPTO API TRÊN FRONTEND
  const encryptKeyRootAES = async (plainKeyHex) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const masterKeyBytes = new TextEncoder().encode(MASTER_KEY_STR);
    
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      masterKeyBytes,
      { name: "AES-CTR" },
      false,
      ["encrypt"]
    );

    const plainBytes = new TextEncoder().encode(plainKeyHex);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-CTR", counter: iv, length: 64 },
      cryptoKey,
      plainBytes
    );

    const ciphertextHex = Array.from(new Uint8Array(cipherBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return { ivHex, ciphertextHex };
  };

  // 4. QUY TRÌNH 1: CẤP PHÁT KEY FOB QUA USB VÀ LƯU FIREBASE
  const handleUSBProvisioning = async () => {
    if (!("serial" in navigator)) {
      alert("Trình duyệt không hỗ trợ Web Serial. Vui lòng dùng Chrome hoặc Edge.");
      return;
    }

    const { car_id, license_plate, car_model, seats, color } = formData;
    if (!car_id.trim() || !license_plate.trim() || !car_model.trim()) {
      alert("Vui lòng nhập đầy đủ Car ID, Biển số xe và Dòng xe!");
      return;
    }

    setIsProcessingFob(true);
    setStatusMessage({ type: 'info', text: "Đang mở cổng USB kết nối với Key Fob..." });

    const randomKey = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const payload = `PROVISION:${JSON.stringify({
      car_id: car_id.trim(),
      license_plate: license_plate.trim(),
      car_model: car_model.trim(),
      key_root: randomKey
    })}\n`;

    let port, reader;
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      reader = textDecoder.readable.getReader();

      await new Promise(r => setTimeout(r, 2000)); // Đợi ổn định

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      setStatusMessage({ type: 'info', text: "Đang nạp dữ liệu xuống Key Fob qua Serial..." });
      await writer.write(payload);
      await writer.close();

      const response = await readResponseWithTimeout(reader, 8000);

      if (response.includes("SUCCESS")) {
        setStatusMessage({ type: 'info', text: "Key Fob xác nhận thành công! Đang mã hóa và đẩy lên Firebase..." });

        // Mã hóa khóa gốc bằng AES-256-CTR
        const { ivHex, ciphertextHex } = await encryptKeyRootAES(randomKey);

        // Đẩy lên SecureKeys
        await set(ref(db, `SecureKeys/${car_id.trim()}`), {
          iv: ivHex,
          encrypted_key_root: ciphertextHex,
          status: 'WAITING_ESP32_DECRYPT',
          created_at: Date.now()
        });

        // Lưu thông tin xe lên Vehicles
        await update(ref(db, `Vehicles/${car_id.trim()}`), {
          car_model: car_model.trim(),
          license_plate: license_plate.trim(),
          color: color,
          seats: seats,
          provisioned_status: 'Ready',
          status: 'AVAILABLE',
          door_status: 'Locked',
          engine_status: 'OFF'
        });

        setStatusMessage({ type: 'success', text: `Cấp phát thành công xe ${car_id} và Key Fob!` });
        setFormData({ car_id: '', license_plate: '', car_model: '', seats: '5', color: 'Trắng' });
      } else {
        throw new Error(response.includes("ERROR:") ? response : "Không nhận được phản hồi hợp lệ từ Key Fob.");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Lỗi: ${err.message}` });
    } finally {
      if (reader) try { reader.releaseLock(); } catch (e) {}
      if (port) try { await port.close(); } catch (e) {}
      setIsProcessingFob(false);
    }
  };

  // 5. QUY TRÌNH 2: NẠP MÃ XE VÀ THẺ NFC CHO ECU ACCESS
  const handleProvisionCarAndNfc = async () => {
    if (!("serial" in navigator)) {
      alert("Trình duyệt không hỗ trợ Web Serial. Vui lòng dùng Chrome hoặc Edge.");
      return;
    }

    const targetCarId = nfcCarId.trim();
    if (!targetCarId) {
      alert("Vui lòng nhập Mã định danh xe (Car ID) ở khu vực cấp thẻ NFC!");
      return;
    }

    setIsProcessingNfc(true);
    let port, reader;
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      reader = textDecoder.readable.getReader();

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      await new Promise(r => setTimeout(r, 2000));

      // BƯỚC 1: SET_CAR_ID
      await writer.write(`SET_CAR_ID:${targetCarId}\n`);
      let response = await readResponseWithTimeout(reader, 8000);
      if (!response.includes("SUCCESS")) {
        throw new Error("Không thể cấu hình CAR_ID trên ECU Access: " + response);
      }

      // BƯỚC 2: CHỜ QUẸT THẺ
      alert(`Đã nạp Car ID thành công!\nBấm OK rồi quẹt thẻ NFC vào đầu đọc trong vòng 10 giây.`);
      const detectedUid = await waitForUidDetected(reader, 10000);
      if (!detectedUid) {
        throw new Error("Không phát hiện thẻ NFC nào được quét trong thời gian quy định.");
      }

      // BƯỚC 3: NFC_ADD
      await writer.write(`NFC_ADD:${detectedUid}\n`);
      response = await readResponseWithTimeout(reader, 5000);
      if (!response.includes("SUCCESS")) {
        throw new Error("Ghi thẻ vào NVS thất bại: " + response);
      }

      await writer.close();

      // BƯỚC 4: ĐỒNG BỘ LÊN FIREBASE REALTIME DATABASE
      await set(ref(db, `NfcWhitelist/${targetCarId}/${detectedUid}`), {
        added_at: Math.floor(Date.now() / 1000)
      });

      setStatusMessage({ type: 'success', text: `Nạp thành công thẻ ${detectedUid} cho xe ${targetCarId}!` });
      setNfcCarId('');
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Lỗi cấp thẻ NFC: ${err.message}` });
    } finally {
      if (reader) try { reader.releaseLock(); } catch (e) {}
      if (port) try { await port.close(); } catch (e) {}
      setIsProcessingNfc(false);
    }
  };

  // 6. QUY TRÌNH 3: XÓA THẺ NFC KHỎI ECU ACCESS VÀ DATABASE
  const handleNFCDelete = async (carId, uid) => {
    if (!("serial" in navigator)) {
      alert("Trình duyệt không hỗ trợ Web Serial. Vui lòng dùng Chrome hoặc Edge.");
      return;
    }

    if (!window.confirm(`Xoá thẻ ${uid} khỏi xe ${carId}?\nBạn cần cắm ECU Access qua USB để xóa dữ liệu phần cứng.`)) {
      return;
    }

    let port, reader;
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      reader = textDecoder.readable.getReader();

      await new Promise(r => setTimeout(r, 2000));

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      // Kiểm tra xem board đang cắm có đúng là car_id này không
      await writer.write("GET_CAR_ID\n");
      const realCarId = await readCarIdWithTimeout(reader, 5000);

      if (!realCarId) {
        throw new Error("Không thể xác định car_id của board đang cắm.");
      }

      if (realCarId !== carId) {
        throw new Error(`Board đang cắm là "${realCarId}", không khớp với "${carId}". Hủy thao tác.`);
      }

      await writer.write(`NFC_DEL:${uid}\n`);
      await writer.close();

      const response = await readResponseWithTimeout(reader, 5000);
      if (response.includes("SUCCESS")) {
        // Xóa trên Firebase
        await remove(ref(db, `NfcWhitelist/${carId}/${uid}`));
        setStatusMessage({ type: 'success', text: `Đã xóa thẻ ${uid} khỏi xe ${carId} và Database!` });
      } else {
        throw new Error("Board từ chối lệnh xóa: " + response);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Lỗi xóa thẻ: ${err.message}` });
    } finally {
      if (reader) try { reader.releaseLock(); } catch (e) {}
      if (port) try { await port.close(); } catch (e) {}
    }
  };

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300 bg-gray-50/50">
      
      {/* THÔNG BÁO TIẾN TRÌNH */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 ${
          statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' && <CheckCircle2 size={20} />}
            {statusMessage.type === 'error' && <AlertCircle size={20} />}
            {statusMessage.type === 'info' && <span className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
      )}

      {/* KHUNG GIAO DIỆN CHÍNH (HAI CỘT) */}
      <div className="max-w-7xl w-full mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* CỘT TRÁI: FORM CẤP PHÁT */}
        <div className="w-full md:w-1/2 p-8 border-r border-gray-100">
          
          {/* PHẦN 1: THÊM XE & CẤP PHÁT KEY FOB */}
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-md shadow-blue-600/20">
              <Wrench size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Thêm Phương Tiện Mới</h2>
              <p className="text-xs text-gray-500">Đẩy thông tin xe lên Firebase Database</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Mã định danh xe (Car ID)</label>
              <input 
                type="text" 
                value={formData.car_id}
                onChange={(e) => setFormData({ ...formData, car_id: e.target.value })}
                placeholder="VD: Car_02, Car_03..." 
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Biển số xe</label>
              <input 
                type="text" 
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                placeholder="VD: 51H-123.45" 
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Dòng xe (Model)</label>
              <input 
                type="text" 
                value={formData.car_model}
                onChange={(e) => setFormData({ ...formData, car_model: e.target.value })}
                placeholder="VD: VinFast VF8" 
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Số chỗ ngồi</label>
                <select 
                  value={formData.seats}
                  onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                >
                  <option value="4">4 chỗ</option>
                  <option value="5">5 chỗ</option>
                  <option value="7">7 chỗ</option>
                  <option value="9">9 chỗ</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Màu sơn: <span className="text-blue-600 lowercase font-medium">({formData.color})</span>
                </label>
                <div className="flex items-center gap-2.5 pt-1">
                  {colors.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.name })}
                      className={`w-7 h-7 rounded-full border border-gray-300 shadow-sm transition-all ${
                        formData.color === c.name ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handleUSBProvisioning}
              disabled={isProcessingFob}
              className="w-full py-3.5 mt-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 flex justify-center items-center gap-2 disabled:opacity-60 text-sm"
            >
              <Usb size={18} /> {isProcessingFob ? "Đang xử lý nạp..." : "Cấp phát Key qua cáp USB"}
            </button>
          </div>

          {/* PHẦN 2: CẤP THẺ NFC DỰ PHÒNG */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500 p-2 rounded-xl text-white shadow-md shadow-orange-500/20">
                <CreditCard size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Cấp thẻ NFC</h2>
                {/* <p className="text-xs text-gray-500">Gửi lệnh trực tiếp tới Car qua cáp USB - không qua Firebase</p> */}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Mã định danh xe (Car ID)</label>
                <input 
                  type="text" 
                  value={nfcCarId}
                  onChange={(e) => setNfcCarId(e.target.value)}
                  placeholder="VD: car_21"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-sm"
                />
              </div>

              <button 
                type="button" 
                onClick={handleProvisionCarAndNfc}
                disabled={isProcessingNfc}
                className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/25 flex justify-center items-center gap-2 disabled:opacity-60 text-sm"
              >
                <Scan size={18} /> {isProcessingNfc ? "Đang đọc thẻ..." : "Nạp mã xe & nạp UID của thẻ NFC"}
              </button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: XE ĐÃ CÓ TRÊN DATABASE */}
        <div className="w-full md:w-1/2 bg-slate-50/50 p-8 flex flex-col h-[800px]">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Xe đã có trên Database
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {Object.keys(vehicles).length === 0 ? (
              <p className="text-center text-gray-400 text-sm italic mt-20">Chưa có phương tiện nào trên hệ thống.</p>
            ) : (
              Object.entries(vehicles).map(([car_id, car_data]) => (
                <div key={car_id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                        <Car size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 flex items-center gap-2">
                          {car_id}
                          {car_data.provisioned_status === 'Ready' && (
                            <Key size={14} className="text-orange-500" title="Đã nạp Key" />
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {car_data.license_plate} • {car_data.car_model}<br/>
                          <span className="font-medium text-blue-600">{car_data.seats || '5'} chỗ</span> • Màu {car_data.color || 'Không rõ'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase border ${
                        car_data.status === 'AVAILABLE' ? 'bg-green-50 text-green-700 border-green-200' :
                        car_data.status === 'IN_USE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {car_data.status || 'AVAILABLE'}
                      </span>
                    </div>
                  </div>

                  {/* DANH SÁCH THẺ NFC TRẮNG LIÊN KẾT */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
                      <CreditCard size={12} /> Thẻ NFC dự phòng
                    </p>
                    {nfcWhitelist[car_id] && Object.keys(nfcWhitelist[car_id]).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.keys(nfcWhitelist[car_id]).map((uid) => (
                          <span key={uid} className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5 text-[11px] font-mono">
                            {uid}
                            <button 
                              type="button" 
                              onClick={() => handleNFCDelete(car_id, uid)}
                              className="text-orange-400 hover:text-red-600 ml-0.5 transition-colors"
                              title="Xoá thẻ này khỏi xe và hệ thống"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Chưa có thẻ nào</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}