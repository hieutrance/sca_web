import React, { useState, useEffect } from 'react';
import { CalendarClock, CheckCircle, XCircle, Search, Clock, Car, User } from 'lucide-react';
import { ref, onValue, update, push, set } from 'firebase/database';
import { db } from '../services/firebase';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const requestsRef = ref(db, 'BookingRequests');
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Chỉ lấy những yêu cầu đang ở trạng thái PENDING
        const pendingRequests = formatted.filter(req => req.status === 'PENDING');
        setRequests(pendingRequests.reverse()); // Mới nhất lên đầu
      } else {
        setRequests([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // HÀM PHÊ DUYỆT YÊU CẦU
  const handleApprove = async (req) => {
    if (!window.confirm(`Xác nhận PHÊ DUYỆT giao xe ${req.car_model} cho khách hàng ${req.customer_name}?`)) return;

    try {
      // 1. Tạo 1 Booking chính thức (Active)
      const newBookingRef = push(ref(db, 'Bookings'));
      
      // Giả lập thời gian hết hạn là 24h sau khi nhận xe
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 1);
      
      await set(newBookingRef, {
        customer_id: req.customer_id,
        car_id: req.car_id,
        expire_time: expireDate.toISOString().replace('T', ' ').substring(0, 16), // Format YYYY-MM-DD HH:mm
        status: 'ACTIVE',
        penalty_fee: 0,
        key_root: "auto_key_" + Math.random().toString(36).substring(7)
      });

      // 2. Chuyển trạng thái xe thành IN_USE
      await update(ref(db, `Vehicles/${req.car_id}`), { status: 'IN_USE' });

      // 3. Đánh dấu Yêu cầu này là đã Duyệt
      await update(ref(db, `BookingRequests/${req.id}`), { status: 'APPROVED' });

      alert("Đã phê duyệt và cấp khóa cho khách hàng thành công!");

    } catch (error) {
      console.error("Lỗi khi duyệt:", error);
      alert("Có lỗi xảy ra khi xử lý!");
    }
  };

  // HÀM TỪ CHỐI YÊU CẦU
  const handleReject = async (reqId) => {
    const reason = window.prompt("Nhập lý do từ chối (Khách hàng sẽ thấy):", "Xe đã có người đặt / Xe đang bảo dưỡng");
    if (reason === null) return; // Bấm Cancel

    try {
      await update(ref(db, `BookingRequests/${reqId}`), { 
        status: 'REJECTED',
        reject_reason: reason
      });
    } catch (error) {
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
            <CalendarClock className="text-orange-500" size={28} /> Phê duyệt Yêu cầu
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
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none w-64 bg-white shadow-sm" 
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
                <th className="px-6 py-4 font-semibold">Dự kiến nhận xe</th>
                <th className="px-6 py-4 font-semibold text-center">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
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
                    <td className="px-6 py-4 font-medium text-orange-600 bg-orange-50/50 rounded-lg inline-block mt-2 ml-6">
                      {req.pickup_time}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold border border-yellow-200 animate-pulse">CHỜ DUYỆT</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleApprove(req)}
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
    </div>
  );
}