import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, X, Phone, User as UserIcon } from 'lucide-react';

import { ref, onValue, set } from 'firebase/database';
import { db } from '../services/firebase';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State cho Modal thêm khách
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Lắng nghe dữ liệu
  useEffect(() => {

    const customersRef = ref(db, 'Customers');
    const unsubscribe = onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setCustomers(formatted.reverse());
      } else {
        setCustomers([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();

  }, []);

  // Hàm thêm khách hàng mới
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {

      const customerRef = ref(db, `Customers/${newId}`);
      await set(customerRef, {
        full_name: newName,
        phone: newPhone
      });
      
      // Reset form
      setNewId('');
      setNewName('');
      setNewPhone('');
      setIsModalOpen(false);

    } catch (error) {
      console.error(error);
      alert('Lỗi khi thêm khách hàng!');
    }
  };

  const filteredCustomers = customers.filter(c => {
    const searchStr = (searchTerm || '').toLowerCase();
    
    // Ép kiểu String() để tránh lỗi khi Firebase lưu dưới dạng Số (Number)
    const idMatch = String(c.id || '').toLowerCase().includes(searchStr);
    const nameMatch = String(c.full_name || '').toLowerCase().includes(searchStr);
    const phoneMatch = String(c.phone || '').includes(searchStr);
    
    return idMatch || nameMatch || phoneMatch;
  });

  return (
    <div className="flex-1 overflow-auto p-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Quản lý Khách hàng</h2>
          <p className="text-sm text-gray-500">Thông tin người dùng đã đăng ký tài khoản trên ứng dụng.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 bg-white" 
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={18} /> Thêm Mới
          </button>
        </div>
      </div>

      {/* Bảng Dữ Liệu */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Đang tải dữ liệu từ Cloud...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold w-24">Mã Khách</th>
                <th className="px-6 py-4 font-semibold">Họ và Tên</th>
                <th className="px-6 py-4 font-semibold">Số điện thoại</th>
                <th className="px-6 py-4 font-semibold">Tài khoản App</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">Chưa có khách hàng nào.</td></tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-500">{customer.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                          {customer.full_name ? customer.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="font-bold text-gray-900">{customer.full_name || 'Chưa cập nhật'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{customer.phone || '---'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase border border-green-200">ĐÃ XÁC MINH</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Thêm Khách Hàng */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Thêm Khách Hàng Mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 p-1"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mã Khách Hàng</label>
                <input required value={newId} onChange={(e) => setNewId(e.target.value)} type="text" placeholder="VD: Cust_002" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và Tên</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input required value={newName} onChange={(e) => setNewName(e.target.value)} type="text" placeholder="VD: Nguyễn Văn B" className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="text" placeholder="VD: 0988..." className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 mt-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Lưu vào Hệ thống</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}