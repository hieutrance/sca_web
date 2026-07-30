import React, { useState, useEffect } from 'react';
import { Car, Search, Archive, Trash2 } from 'lucide-react';

import { ref, onValue, remove } from 'firebase/database';
import { db } from '../services/firebase';

export default function BookingHistory() {
  const [history, setHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {

    const bookingsRef = ref(db, 'Bookings');
    const customersRef = ref(db, 'Customers');

    // Lấy dữ liệu Khách hàng để hiển thị tên
    const unsubCustomers = onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setCustomers(formatted);
      }
    });

    // Lấy dữ liệu Bookings và CHỈ LỌC các chuyến đã HOÀN TẤT
    const unsubBookings = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const completedBookings = formatted.filter(b => b.status === 'COMPLETED');
        setHistory(completedBookings.reverse()); // Mới nhất lên đầu
      } else {
        setHistory([]);
      }
      setIsLoading(false);
    });

    return () => {
      unsubBookings();
      unsubCustomers();
    };

  }, []);

  // Cho phép xóa lịch sử cũ cho nhẹ Database
  const handleDeleteHistory = async (bookingId) => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN lịch sử chuyến đi này?')) return;
    try {
      // --- MÃ DÀNH CHO MÔI TRƯỜNG XEM TRƯỚC TRÊN CANVAS ---
      setHistory(prev => prev.filter(h => h.id !== bookingId));

      // --- MÃ DÀNH CHO VS CODE CỦA BẠN (Bỏ comment đoạn dưới đây để dùng thật) ---
      // await remove(ref(db, `Bookings/${bookingId}`));
    } catch (error) {
      console.error("Lỗi khi xóa:", error);
      alert("Có lỗi xảy ra!");
    }
  };

  // Lọc theo thanh tìm kiếm
  const filteredHistory = history.filter(h => 
    h.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (h.car_id && h.car_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300 bg-gray-50/50">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1 flex items-center gap-2">
            <Archive className="text-blue-600" size={28} /> Lịch sử Thuê Xe
          </h2>
          <p className="text-sm text-gray-500">Lưu trữ các phiên thuê xe đã kết thúc và thanh toán hoàn tất.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm theo mã vé, mã xe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 bg-white shadow-sm" 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Đang tải lịch sử từ Cloud...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold">Mã Booking</th>
                <th className="px-6 py-4 font-semibold">Khách Hàng</th>
                <th className="px-6 py-4 font-semibold">Xe Sử Dụng</th>
                <th className="px-6 py-4 font-semibold">Trạng Thái</th>
                <th className="px-6 py-4 font-semibold text-center">Xóa Bỏ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredHistory.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Chưa có dữ liệu lịch sử nào.</td></tr>
              ) : (
                filteredHistory.map((item) => {
                  const customerInfo = customers.find(c => c.id === item.customer_id);
                  const customerName = customerInfo ? customerInfo.full_name : 'Chưa cập nhật tên';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4"><span className="font-mono text-xs font-semibold text-gray-400">{item.id.length > 15 ? '...' + item.id.slice(-8) : item.id}</span></td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-700">{customerName}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{item.customer_id}</p>
                      </td>
                      <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-600 rounded font-mono text-sm border border-gray-200"><Car size={14}/> {item.car_id}</span></td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold border border-gray-200">ĐÃ HOÀN TẤT</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleDeleteHistory(item.id)}
                          title="Xóa khỏi lịch sử" 
                          className="p-1.5 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors inline-flex"
                        >
                          <Trash2 size={16} />
                        </button>
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