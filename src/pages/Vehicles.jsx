import React, { useState, useEffect } from 'react';
import { Car, Lock, Unlock, Search, ShieldCheck } from 'lucide-react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../services/firebase';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {


    const vehiclesRef = ref(db, 'Vehicles');
    const unsubscribe = onValue(vehiclesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Biến object thành array
        const formatted = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setVehicles(formatted);
      } else {
        setVehicles([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();

  }, []);

  // Hàm cập nhật trạng thái kinh doanh của xe
  const handleStatusChange = async (carId, newStatus) => {
    // Chuyển đổi tên tiếng Việt để hiện hộp thoại xác nhận cho đẹp
    const statusName = newStatus === 'AVAILABLE' ? 'SẴN SÀNG' : newStatus === 'MAINTENANCE' ? 'BẢO DƯỠNG' : 'SỬA CHỮA';
    
    if (!window.confirm(`Xác nhận chuyển xe ${carId} sang trạng thái: ${statusName}?`)) return;
    
    try {

        await update(ref(db, `Vehicles/${carId}`), { status: newStatus });
      
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Lỗi khi cập nhật trạng thái!");
    }
  };

  // Lọc xe theo tìm kiếm
  const filteredVehicles = vehicles.filter(v => 
    v.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (v.license_plate && v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Quản lý Phương tiện</h2>
          <p className="text-sm text-gray-500">Giám sát trạng thái vật lý và tình trạng kinh doanh của xe.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm mã xe, biển số..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 bg-white shadow-sm" 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Đang tải dữ liệu xe từ Cloud...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold">Mã Xe / Biển số</th>
                <th className="px-6 py-4 font-semibold">Dòng Xe</th>
                <th className="px-6 py-4 font-semibold text-center">Tình Trạng (Kinh Doanh)</th>
                <th className="px-6 py-4 font-semibold text-center">Khóa Cửa</th>
                <th className="px-6 py-4 font-semibold text-center">Khóa Nạp (Provisioning)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Không tìm thấy phương tiện nào.</td></tr>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Car size={18} /></div>
                        <div>
                          <p className="font-bold text-gray-900">{vehicle.id}</p>
                          <p className="text-xs font-mono text-gray-500">{vehicle.license_plate || 'Chưa cập nhật'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">{vehicle.car_model || '---'}</td>
                    
                    {/* CỘT MENU THẢ XUỐNG TÙY CHỈNH TRẠNG THÁI */}
                    <td className="px-6 py-4 text-center">
                      <select 
                        value={vehicle.status || 'AVAILABLE'}
                        onChange={(e) => handleStatusChange(vehicle.id, e.target.value)}
                        disabled={vehicle.status === 'IN_USE'} // Khóa select nếu đang cho thuê
                        title={vehicle.status === 'IN_USE' ? "Xe đang cho thuê, không thể tự ý đổi trạng thái" : "Nhấn để đổi trạng thái"}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border outline-none text-center transition-colors shadow-sm
                          ${vehicle.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200 cursor-pointer' : 
                            vehicle.status === 'IN_USE' ? 'bg-orange-100 text-orange-700 border-orange-200 opacity-80 cursor-not-allowed' : 
                            vehicle.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200 cursor-pointer' :
                            'bg-red-100 text-red-700 border-red-200 hover:bg-red-200 cursor-pointer'}`}
                      >
                        <option value="AVAILABLE">SẴN SÀNG</option>
                        <option value="IN_USE" disabled>ĐANG THUÊ</option>
                        <option value="MAINTENANCE">BẢO DƯỠNG</option>
                        <option value="REPAIR">SỬA CHỮA</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 text-center">
                      {vehicle.door_status === 'Locked' ? 
                        <span className="inline-flex flex-col items-center text-red-500"><Lock size={18} /><span className="text-[10px] font-bold mt-1">LOCKED</span></span> : 
                        <span className="inline-flex flex-col items-center text-green-500"><Unlock size={18} /><span className="text-[10px] font-bold mt-1">UNLOCKED</span></span>
                      }
                    </td>
                    <td className="px-6 py-4 text-center">
                      {vehicle.provisioned_status === 'Ready' ? 
                         <span className="inline-flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-1 rounded text-xs border border-teal-100 font-medium"><ShieldCheck size={14}/> Đã nạp</span> :
                         <span className="text-gray-400 text-xs italic">Chưa nạp</span>
                      }
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