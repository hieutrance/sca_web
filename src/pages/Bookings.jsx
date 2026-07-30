import React, { useState, useEffect } from 'react';
import { Car, Plus, X, Key, AlertTriangle, ArrowLeft, UserCheck, CheckCircle2, Trash2, CheckSquare } from 'lucide-react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../services/firebase';

export default function Bookings() {
  // --- QUẢN LÝ TRẠNG THÁI GIAO DIỆN ---
  const [viewMode, setViewMode] = useState('list'); 
  const [isLoading, setIsLoading] = useState(true);

  // --- QUẢN LÝ DỮ LIỆU TỪ FIREBASE ---
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // --- QUẢN LÝ FORM ---
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [expireTime, setExpireTime] = useState('');

  // LẮNG NGHE ĐỒNG THỜI 3 BẢNG DỮ LIỆU TỪ FIREBASE
  useEffect(() => {
    const bookingsRef = ref(db, 'Bookings');
    const customersRef = ref(db, 'Customers');
    const vehiclesRef = ref(db, 'Vehicles');
    
    // 1. Lắng nghe Bookings
    const unsubBookings = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setBookings(formatted.reverse());
      } else {
        setBookings([]);
      }
      setIsLoading(false);
    });

    // 2. Lắng nghe Customers (Để lấy tên khách hàng)
    const unsubCustomers = onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setCustomers(formatted);
      }
    });

    // 3. Lắng nghe Vehicles (Chỉ lấy xe Rảnh)
    const unsubVehicles = onValue(vehiclesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // CHỈ LẤY NHỮNG XE ĐANG "AVAILABLE" ĐỂ HIỂN THỊ VÀO DANH SÁCH CHỌN
        const availableVehicles = formatted.filter(v => v.status === 'AVAILABLE');
        setVehicles(availableVehicles);
      } else {
        setVehicles([]);
      }
    });

    return () => {
      unsubBookings();
      unsubCustomers();
      unsubVehicles();
    };
  }, []);

  // HÀM GHI DỮ LIỆU
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedVehicle) {
      alert("Vui lòng chọn cả Khách hàng và Phương tiện từ danh sách bên trái!");
      return;
    }

    const newBookingData = {
      car_id: selectedVehicle.id,
      customer_id: selectedCustomer.id,
      expire_time: expireTime.replace('T', ' '), 
      key_root: "random_key_" + Math.random().toString(36).substring(7),
      penalty_fee: 0,
      status: "ACTIVE"
    };

    try {
      // 1. Tạo Booking mới
      const newBookingRef = push(ref(db, 'Bookings'));
      await set(newBookingRef, newBookingData);
      
      // 2. Cập nhật lại trạng thái xe thành "ĐANG THUÊ"
      const vehicleRef = ref(db, `Vehicles/${selectedVehicle.id}`);
      await update(vehicleRef, { status: 'IN_USE' });
      
      // Reset form & quay lại màn hình danh sách
      setSelectedCustomer(null);
      setSelectedVehicle(null);
      setExpireTime('');
      setViewMode('list');
      
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Có lỗi xảy ra khi tạo mã!");
    }
  };

  // HÀM 1: KẾT THÚC PHIÊN THUÊ (Lưu lịch sử Booking, thu hồi Khóa và Xe)
  const handleEndBooking = async (bookingId, carId) => {
    if (!window.confirm('Xác nhận KẾT THÚC phiên thuê này? Xe sẽ được thu hồi về trạng thái SẴN SÀNG.')) return;
    try {
      await update(ref(db, `Bookings/${bookingId}`), { status: 'COMPLETED' });
      await update(ref(db, `Vehicles/${carId}`), { status: 'AVAILABLE' });
      await remove(ref(db, `SecureKeys/${carId}`)); // Xóa Key bảo mật khỏi hệ thống
    } catch (error) {
      console.error("Lỗi khi kết thúc:", error);
      alert("Có lỗi xảy ra!");
    }
  };

  // HÀM 2: XÓA PHIÊN THUÊ (Xóa vĩnh viễn khỏi Database, thu hồi Khóa và Xe)
  const handleDeleteBooking = async (bookingId, carId) => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN phiên thuê này khỏi lịch sử?')) return;
    try {
      await remove(ref(db, `Bookings/${bookingId}`));
      await update(ref(db, `Vehicles/${carId}`), { status: 'AVAILABLE' });
      await remove(ref(db, `SecureKeys/${carId}`)); // Xóa Key bảo mật
    } catch (error) {
      console.error("Lỗi khi xóa:", error);
      alert("Có lỗi xảy ra!");
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'ACTIVE': return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">ĐANG THUÊ</span>;
      case 'OVERDUE': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1"><AlertTriangle size={12}/> QUÁ HẠN</span>;
      case 'COMPLETED': return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold border border-gray-200">ĐÃ TRẢ XE</span>;
      default: return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  // ==========================================
  // GIAO DIỆN 1: MÀN HÌNH TẠO PHIÊN THUÊ (FULL-SCREEN SPLIT PANE)
  // ==========================================
  if (viewMode === 'create') {
    return (
      <div className="flex-1 flex flex-col h-full bg-white overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0 z-10">
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Thiết Lập Phiên Thuê Xe</h2>
            <p className="text-xs text-gray-500">Chọn khách hàng và phương tiện để hệ thống cấp khóa Digital Key.</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50">
          <div className="flex-[2] flex flex-col p-6 lg:p-8 gap-6 overflow-y-auto">
            {/* Khách hàng */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[300px]">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center shrink-0">
                <span>1. Chọn Khách Hàng</span>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{customers.length} người</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {customers.map(c => {
                  const isSelected = selectedCustomer?.id === c.id;
                  return (
                    <div key={c.id} onClick={() => setSelectedCustomer(c)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}><UserCheck size={20} /></div>
                        <div>
                          <p className="font-bold text-gray-900">{c.full_name || 'Khách hàng chưa có tên'}</p>
                          <p className="text-sm text-gray-500 font-mono mt-0.5">ID: {c.id} • {c.phone || 'Chưa cập nhật SĐT'}</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="text-blue-600" size={24} />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Xe cộ */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[300px]">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center shrink-0">
                <span>2. Chọn Phương Tiện</span>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{vehicles.length} xe</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {vehicles.map(v => {
                  const isSelected = selectedVehicle?.id === v.id;
                  return (
                    <div key={v.id} onClick={() => setSelectedVehicle(v)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-teal-50/50 border-teal-500 ring-1 ring-teal-500 shadow-sm' : 'bg-white border-gray-200 hover:border-teal-300 hover:shadow-sm'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isSelected ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'}`}><Car size={20} /></div>
                        <div>
                          <p className="font-bold text-gray-900">{v.id}</p>
                          <p className="text-sm text-gray-500 mt-0.5">Cửa: <span className="font-medium text-gray-700">{v.door_status || 'Không rõ'}</span> • Máy: <span className="font-medium text-gray-700">{v.engine_status || 'Không rõ'}</span></p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="text-teal-600" size={24} />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[420px] xl:w-[480px] bg-white border-l border-gray-200 flex flex-col shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.03)] z-10 shrink-0">
            <div className="bg-slate-900 px-6 py-5 flex items-center gap-3 shrink-0">
              <div className="p-2 bg-blue-500/20 rounded-lg"><Key className="text-blue-400" size={20} /></div>
              <div>
                <h3 className="font-bold text-white text-lg">Xác nhận cấp khóa</h3>
                <p className="text-xs text-slate-400">Digital Key Provisioning</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <form id="bookingForm" onSubmit={handleCreateBooking} className="p-6 lg:p-8 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Thông tin đã chọn</h4>
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                      <span className="text-sm text-gray-500 font-medium">Khách hàng:</span>
                      <span className="font-bold text-gray-900 text-right">{selectedCustomer ? selectedCustomer.full_name || selectedCustomer.id : <span className="text-red-500 italic font-normal">Chưa chọn</span>}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 font-medium">Xe cấp phát:</span>
                      <span className="font-mono font-bold text-teal-700 text-right text-base">{selectedVehicle ? selectedVehicle.id : <span className="text-red-500 italic font-normal text-sm">Chưa chọn</span>}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cài đặt thời hạn</h4>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">3. Thời Gian Trả Xe (Expire Time)</label>
                    <input required value={expireTime} onChange={(e) => setExpireTime(e.target.value)} type="datetime-local" className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white shadow-sm" />
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 mt-4">
                  <p className="text-sm text-blue-800 flex gap-3 leading-relaxed">
                    <AlertTriangle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>Hệ thống sẽ tự động ghép nối và sinh khóa mã hóa <strong>Key_root</strong> đẩy lên Firebase sau khi xác nhận.</span>
                  </p>
                </div>
              </form>
            </div>

            <div className="p-6 bg-white border-t border-gray-100 shrink-0">
              <button type="submit" form="bookingForm" disabled={!selectedCustomer || !selectedVehicle || !expireTime} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-base">
                BẮT ĐẦU PHIÊN THUÊ XE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN 2: MÀN HÌNH DANH SÁCH (MẶC ĐỊNH)
  // ==========================================
  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Quản lý Phiên Thuê Xe</h2>
          <p className="text-sm text-gray-500">Quản lý cấp phát khóa số, theo dõi lịch trình và xử lý quá hạn.</p>
        </div>
        <button onClick={() => setViewMode('create')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
          <Plus size={20} /> Tạo Phiên Thuê Mới
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Đang tải dữ liệu từ Cloud...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold">Mã Booking</th>
                <th className="px-6 py-4 font-semibold">Khách Hàng</th>
                <th className="px-6 py-4 font-semibold">Xe</th>
                <th className="px-6 py-4 font-semibold">Hết Hạn</th>
                <th className="px-6 py-4 font-semibold">Trạng Thái</th>
                <th className="px-6 py-4 font-semibold text-right">Phí Phạt</th>
                <th className="px-6 py-4 font-semibold text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">Chưa có phiên thuê xe nào.</td></tr>
              ) : (
                bookings.map((booking) => {
                  const customerInfo = customers.find(c => c.id === booking.customer_id);
                  const customerName = customerInfo ? customerInfo.full_name : 'Chưa cập nhật tên';

                  return (
                    <tr key={booking.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4"><span className="font-mono text-xs font-semibold text-gray-500" title={booking.id}>{booking.id.length > 15 ? '...' + booking.id.slice(-8) : booking.id}</span></td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{customerName}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{booking.customer_id}</p>
                      </td>
                      <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-800 rounded font-mono text-sm border border-gray-200"><Car size={14} className="text-gray-500"/> {booking.car_id}</span></td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">{booking.expire_time}</td>
                      <td className="px-6 py-4">{getStatusBadge(booking.status)}</td>
                      <td className="px-6 py-4 text-right">{booking.penalty_fee > 0 ? <span className="font-bold text-red-600">{booking.penalty_fee.toLocaleString('vi-VN')} đ</span> : <span className="text-gray-400">-</span>}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Nút Kết Thúc: Chỉ hiện khi phiên chưa COMPLETED */}
                          {booking.status !== 'COMPLETED' && (
                            <button 
                              onClick={() => handleEndBooking(booking.id, booking.car_id)}
                              title="Kết thúc phiên thuê (Đã trả xe)" 
                              className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            >
                              <CheckSquare size={18} />
                            </button>
                          )}
                          {/* Nút Xóa: Luôn hiện để có thể xóa sạch lịch sử */}
                          <button 
                            onClick={() => handleDeleteBooking(booking.id, booking.car_id)}
                            title="Xóa vĩnh viễn" 
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}