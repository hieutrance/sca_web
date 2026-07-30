import React, { useState, useEffect } from 'react';
import { Car, Key, AlertTriangle, Users, TrendingUp, Activity, Clock, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  
  // State chứa dữ liệu biểu đồ thật
  const [chartData, setChartData] = useState([]);
  
  // Các biến đếm thống kê
  const [stats, setStats] = useState({
    available: 0,
    inUse: 0,
    overdue: 0,
    totalCustomers: 0
  });

  // Lưu danh sách 5 chuyến xe gần nhất
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    const vehiclesRef = ref(db, 'Vehicles');
    const bookingsRef = ref(db, 'Bookings');
    const customersRef = ref(db, 'Customers');

    let vData = [], bData = [], cData = [];

    // 1. Lắng nghe Vehicles
    const unsubV = onValue(vehiclesRef, (snapshot) => {
      const data = snapshot.val() || {};
      vData = Object.keys(data).map(key => data[key]);
      updateStats();
    });

    // 2. Lắng nghe Bookings
    const unsubB = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val() || {};
      bData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      
      // Lấy 5 cuốc xe mới nhất (Active hoặc Overdue)
      const activeOnly = bData.filter(b => b.status !== 'COMPLETED');
      setRecentBookings(activeOnly.reverse().slice(0, 5));
      
      // TÍNH TOÁN DỮ LIỆU BIỂU ĐỒ 7 NGÀY QUA TỪ DATABASE
      const today = new Date();
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        last7Days.push({ 
          dateRaw: d.toDateString(), 
          name: `${d.getDate()}/${d.getMonth()+1}`, 
          bookings: 0, 
          revenue: 0 
        });
      }

      bData.forEach(booking => {
        if (booking.expire_time) {
           const bDate = new Date(booking.expire_time.split(' ')[0]); 
           const match = last7Days.find(day => day.dateRaw === bDate.toDateString());
           if (match) {
              match.bookings += 1;
              // Tính doanh thu: Giả định 1 cuốc 500k + phí phạt
              match.revenue += 500000 + (Number(booking.penalty_fee) || 0);
           }
        }
      });
      setChartData(last7Days);

      updateStats();
    });

    // 3. Lắng nghe Customers
    const unsubC = onValue(customersRef, (snapshot) => {
      const data = snapshot.val() || {};
      cData = Object.keys(data);
      updateStats();
    });

    // Hàm tổng hợp tính toán số liệu
    const updateStats = () => {
      setStats({
        available: vData.filter(v => v.status === 'AVAILABLE').length,
        inUse: vData.filter(v => v.status === 'IN_USE').length,
        overdue: bData.filter(b => b.status === 'OVERDUE').length,
        totalCustomers: cData.length
      });
      setIsLoading(false);
    };

    return () => {
      unsubV(); unsubB(); unsubC();
    };
  }, []);

  const StatCard = ({ title, value, icon, trend, color, bgColor }) => (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
          <h3 className="text-3xl font-extrabold text-gray-900">{isLoading ? '-' : value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${bgColor} text-white shadow-inner group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <TrendingUp size={16} className={color} />
        <span className={`font-semibold ${color}`}>{trend}</span>
        <span className="text-gray-400">so với tuần trước</span>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-gray-50/50">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Tổng quan Hệ thống</h2>
          <p className="text-sm text-gray-500">Giám sát hiệu suất hoạt động và trạng thái đội xe theo thời gian thực.</p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100 flex items-center gap-2 shadow-sm">
          <Activity size={18} className="animate-pulse" /> Hệ thống đang hoạt động tốt
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Xe Đang Rảnh" 
          value={stats.available} 
          icon={<Car size={24} />} 
          trend="+2 xe" 
          color="text-emerald-500" 
          bgColor="bg-gradient-to-br from-emerald-400 to-teal-500" 
        />
        <StatCard 
          title="Xe Đang Cho Thuê" 
          value={stats.inUse} 
          icon={<Key size={24} />} 
          trend="+15%" 
          color="text-blue-500" 
          bgColor="bg-gradient-to-br from-blue-500 to-indigo-600" 
        />
        <StatCard 
          title="Phiên Quá Hạn" 
          value={stats.overdue} 
          icon={<AlertTriangle size={24} />} 
          trend="-1 phiên" 
          color={stats.overdue > 0 ? "text-red-500" : "text-gray-400"} 
          bgColor={stats.overdue > 0 ? "bg-gradient-to-br from-red-500 to-rose-600 animate-pulse" : "bg-gradient-to-br from-gray-400 to-slate-500"} 
        />
        <StatCard 
          title="Tổng Khách Hàng" 
          value={stats.totalCustomers} 
          icon={<Users size={24} />} 
          trend="+5 người" 
          color="text-purple-500" 
          bgColor="bg-gradient-to-br from-purple-500 to-fuchsia-600" 
        />
      </div>

      {}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* BIỂU ĐỒ (Chiếm 2 cột) */}
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 text-lg">Lưu lượng Thuê xe (7 ngày qua)</h3>
            <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1.5 outline-none text-gray-600">
              <option>Tuần này</option>
              <option>Tháng này</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                />
                <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" name="Số cuốc xe" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* HOẠT ĐỘNG GẦN ĐÂY (Chiếm 1 cột) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 text-lg">Hoạt động gần đây</h3>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Live</span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {isLoading ? (
               <div className="flex justify-center items-center h-full text-gray-400"><Activity className="animate-spin" /></div>
            ) : recentBookings.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                 <Clock size={32} className="opacity-50" />
                 <p className="text-sm">Chưa có giao dịch nào.</p>
               </div>
            ) : (
              recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                  <div className={`p-2 rounded-full mt-0.5 shrink-0 ${booking.status === 'OVERDUE' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {booking.status === 'OVERDUE' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      Giao xe <span className="text-blue-600 font-mono">{booking.car_id}</span>
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">Mã KH: {booking.customer_id}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${booking.status === 'OVERDUE' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                      {booking.status === 'OVERDUE' ? 'QUÁ HẠN' : 'ĐANG THUÊ'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <button className="w-full mt-4 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
            Xem tất cả phiên thuê
          </button>
        </div>

      </div>
    </div>
  );
}