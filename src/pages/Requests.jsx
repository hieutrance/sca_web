import React, { useState, useEffect } from 'react';
import { CalendarClock, CheckCircle, XCircle, Search, Clock, Car, User, X, Calendar } from 'lucide-react';
import { ref, onValue, update, push, set } from 'firebase/database';
import { db } from '../services/firebase';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // State Modal duyệt đơn cho Admin
  const [selectedReq, setSelectedReq] = useState(null);
  const [approvalExpireTime, setApprovalExpireTime] = useState('');

  useEffect(() => {
    const requestsRef = ref(db, 'BookingRequests');
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        const pendingRequests = formatted.filter(req => req.status === 'PENDING');
        setRequests(pendingRequests.reverse());
      } else {
        setRequests([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Khi bấm nút Duyệt trên bảng: Mở Modal và nạp mốc thời gian khách yêu cầu
  const openApproveModal = (req) => {
    setSelectedReq(req);
    if (req.return_time) {
      // Chuyển định dạng YYYY-MM-DD HH:mm sang YYYY-MM-DDTHH:mm cho input HTML5
      setApprovalExpireTime(req.return_time.replace(' ', 'T'));
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setApprovalExpireTime(tomorrow.toISOString().substring(0, 16));
    }
  };

  // Xác nhận Duyệt sau khi Admin đã xem xét / chỉnh sửa thời gian trả xe
const handleConfirmApproval = async (e) => {
    e.preventDefault();
    if (!selectedReq || !approvalExpireTime) return;

    try {
      const finalExpireTime = approvalExpireTime.replace('T', ' ');
      
      // CHUYỂN ĐỔI THỜI GIAN ĐƯỢC DUYỆT SANG UNIX TIMESTAMP
      const unixTimestamp = Math.floor(new Date(approvalExpireTime).getTime() / 1000);

      const newBookingRef = push(ref(db, 'Bookings'));
      await set(newBookingRef, {
        customer_id: selectedReq.customer_id,
        car_id: selectedReq.car_id,
        expire_time: finalExpireTime, 
        status: 'ACTIVE',
        penalty_fee: 0,
        key_root: "auto_key_" + Math.random().toString(36).substring(7)
      });

      await update(ref(db, `Vehicles/${selectedReq.car_id}`), { status: 'IN_USE' });
      
      await update(ref(db, `BookingRequests/${selectedReq.id}`), { 
        status: 'APPROVED',
        approved_expire_time: finalExpireTime
      });

      // [ĐÃ SỬA LỖI Ở ĐÂY] Cập nhật CỤC BỘ bằng cấu trúc Nested Update
      // Điều này báo Firebase chỉ thêm trường 'expire_timestamp' vào bên dưới car_id, 
      // giữ nguyên toàn bộ encrypted_key_root và iv
      const secureUpdates = {};
      secureUpdates[`SecureKeys/${selectedReq.car_id}/expire_timestamp`] = unixTimestamp;
      await update(ref(db), secureUpdates);

      setSelectedReq(null);
      alert(`Đã duyệt đơn thành công! Hạn sử dụng khóa: ${finalExpireTime}`);
    } catch (error) {
      console.error("Lỗi khi duyệt:", error);
      alert("Có lỗi xảy ra khi xử lý!");
    }
};
  const handleReject = async (reqId) => {
    const reason = window.prompt("Nhập lý do từ chối (Khách hàng sẽ thấy):", "Xe đã có người đặt / Xe đang bảo dưỡng");
    if (reason === null) return;

    try {
      await update(ref(db, `BookingRequests/${reqId}`), { 
        status: 'REJECTED',
        reject_reason: reason
      });
    } catch {
      alert("Có lỗi xảy ra!");
    }
  };

  const filteredRequests = requests.filter(r => 
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.car_model?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1 flex items-center gap-2">
            Phê duyệt Yêu cầu
          </h2>
          <p className="text-sm text-gray-500">Danh sách khách hàng đang chờ xét duyệt để nhận khóa xe.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm tên khách, xe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none w-64 bg-white shadow-sm" 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Đang tải yêu cầu...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold">Khách hàng</th>
                <th className="px-6 py-4 font-semibold">Xe yêu cầu</th>
                <th className="px-6 py-4 font-semibold">Thời gian nhận</th>
                <th className="px-6 py-4 font-semibold">Dự kiến trả xe</th>
                <th className="px-6 py-4 font-semibold text-center">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                    <Clock size={40} className="text-gray-300" />
                    <p>Hiện không có yêu cầu thuê xe nào đang chờ duyệt.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-full"><User size={18} /></div>
                        <div>
                          <p className="font-bold text-gray-900">{req.customer_name}</p>
                          <p className="text-xs text-gray-500">{req.customer_phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Car size={16} className="text-blue-600" />
                        <span className="font-semibold text-gray-800">{req.car_model}</span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{req.car_id}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {req.pickup_time}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                        {req.return_time || 'Chưa định dạng'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold border border-yellow-200 animate-pulse">CHỜ DUYỆT</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openApproveModal(req)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-green-600/20"
                        >
                          <CheckCircle size={16} /> Duyệt
                        </button>
                        <button 
                          onClick={() => handleReject(req.id)}
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Từ chối"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL PHÊ DUYỆT & CHỈNH SỬA THỜI HẠN DÀNH CHO ADMIN */}
      {selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Calendar className="text-blue-400" size={20} />
                <h3 className="font-bold text-base">Xác nhận Phê duyệt & Cấp khóa</h3>
              </div>
              <button onClick={() => setSelectedReq(null)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmApproval} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
                <p><span className="text-gray-500">Khách hàng:</span> <strong className="text-gray-800">{selectedReq.customer_name}</strong> ({selectedReq.customer_phone})</p>
                <p><span className="text-gray-500">Phương tiện:</span> <strong className="text-blue-600">{selectedReq.car_model}</strong> ({selectedReq.car_id})</p>
                <p><span className="text-gray-500">Thời gian nhận:</span> {selectedReq.pickup_time}</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Thời gian hết hạn khóa (Admin có thể chỉnh sửa):
                </label>
                <input 
                  type="datetime-local" 
                  required
                  value={approvalExpireTime} 
                  onChange={(e) => setApprovalExpireTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <p className="text-xs text-gray-400 mt-1">Hệ thống sẽ khóa chốt và tính phí phạt nếu khách dùng quá giờ này.</p>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedReq(null)} 
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-600/30"
                >
                  Cấp Khóa Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}