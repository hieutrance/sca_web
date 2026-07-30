import React, { useState, useEffect } from 'react';
import { Home, Car, Users, Calendar, Archive, Search, Bell, Key, ClipboardList, MessageSquare } from 'lucide-react'; 

// 1. IMPORT CÁC TRANG (PAGES)
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Customers from './pages/Customers';
import Bookings from './pages/Bookings';
import BookingHistory from './pages/BookingHistory';
import Requests from './pages/Requests';
import Login from './pages/Login';
import ChatSupport from './pages/ChatSupport'; // <--- IMPORT TRANG MỚI VÀO ĐÂY

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { ref, onValue } from 'firebase/database';

export default function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State đếm số lượng yêu cầu thuê và tin nhắn chưa đọc
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0); 

  // State mở popup chuông thông báo
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    setUser({ email: 'admin@smartrental.com' });
    setIsCheckingAuth(false);
    
    // Lắng nghe Firebase đếm Yêu cầu PENDING
    const requestsRef = ref(db, 'BookingRequests');
    const unsubReq = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.values(data).filter((req) => req.status === 'PENDING').length;
        setPendingCount(count);
      } else {
        setPendingCount(0);
      }
    });

    // Lắng nghe Firebase đếm Tin nhắn chưa đọc của Admin
    const chatsRef = ref(db, 'Chats');
    const unsubChat = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.values(data).filter((chat) => chat.meta && chat.meta.unread_admin === true).length;
        setUnreadChatCount(count);
      } else {
        setUnreadChatCount(0);
      }
    });

    return () => {
      unsubReq();
      unsubChat();
    };
  }, []);

  const handleLogout = () => {
    setUser(null); 
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white">
        <Key className="text-blue-500 animate-pulse mb-4" size={40} />
        <p className="font-medium">Đang kết nối hệ thống...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'requests': return <Requests />; 
      case 'vehicles': return <Vehicles />;
      case 'customers': return <Customers />;
      case 'bookings': return <Bookings />;
      case 'history': return <BookingHistory />;
      case 'chat': return <ChatSupport />; // <--- RENDER TRANG MỚI
      default: return <Dashboard />;
    }
  };

  const sidebarBtnStyle = (tabName) => {
    const baseStyle = "flex items-center w-full px-4 py-3 rounded-lg transition-colors text-left relative font-medium ";
    return activeTab === tabName 
      ? baseStyle + "bg-blue-600 text-white shadow-md" 
      : baseStyle + "text-slate-300 hover:bg-slate-800";
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 w-full">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-700 shrink-0">
          <Key className="text-blue-400 mr-3" size={24} />
          <h1 className="text-lg font-bold text-white tracking-wide">DIGITAL KEY</h1>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={sidebarBtnStyle('dashboard')}>
            <Home className="mr-3" size={20} /> Tổng quan
          </button>

          <button onClick={() => setActiveTab('requests')} className={sidebarBtnStyle('requests')}>
            <ClipboardList className="mr-3" size={20} /> Yêu cầu thuê
            {pendingCount > 0 && (
              <span className="absolute right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          {/* TAB HỖ TRỢ CHAT MỚI */}
          <button onClick={() => setActiveTab('chat')} className={sidebarBtnStyle('chat')}>
            <MessageSquare className="mr-3" size={20} /> Hỗ trợ CSKH
            {unreadChatCount > 0 && (
              <span className="absolute right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>

          <div className="h-px bg-slate-800 my-4 mx-2"></div>

          <button onClick={() => setActiveTab('vehicles')} className={sidebarBtnStyle('vehicles')}>
            <Car className="mr-3" size={20} /> Phương tiện
          </button>
          <button onClick={() => setActiveTab('customers')} className={sidebarBtnStyle('customers')}>
            <Users className="mr-3" size={20} /> Khách hàng
          </button>
          <button onClick={() => setActiveTab('bookings')} className={sidebarBtnStyle('bookings')}>
            <Calendar className="mr-3" size={20} /> Đang hoạt động
          </button>
          <button onClick={() => setActiveTab('history')} className={sidebarBtnStyle('history')}>
            <Archive className="mr-3" size={20} /> Lịch sử thuê xe
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Tìm kiếm..." className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full text-sm focus:bg-white focus:border-blue-500 outline-none w-64" />
          </div>
          <div className="flex items-center gap-4">
            
            {/* VÙNG CHUÔNG THÔNG BÁO */}
            <div className="relative">
              <button 
                onClick={() => setShowNotif(!showNotif)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"
              >
                <Bell size={20} />
                {(pendingCount > 0 || unreadChatCount > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>
              
              {/* BẢNG DROPDOWN THÔNG BÁO */}
              {showNotif && (
                <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-bold text-gray-700">Thông báo mới</span>
                    {(pendingCount > 0 || unreadChatCount > 0) && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-bold">
                        {pendingCount + unreadChatCount}
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pendingCount === 0 && unreadChatCount === 0 ? (
                       <div className="p-6 text-center text-sm text-gray-500">Chưa có thông báo nào mới.</div>
                    ) : (
                       <div className="divide-y divide-gray-50">
                         {pendingCount > 0 && (
                           <div onClick={() => { setActiveTab('requests'); setShowNotif(false); }} className="p-4 hover:bg-blue-50 cursor-pointer flex gap-3 transition-colors">
                             <div className="p-2 bg-blue-100 rounded-full h-fit"><ClipboardList size={18} className="text-blue-600"/></div>
                             <div>
                               <p className="text-sm font-semibold text-gray-900">Yêu cầu thuê xe</p>
                               <p className="text-xs text-gray-500 mt-0.5">Bạn có <span className="font-bold text-blue-600">{pendingCount} yêu cầu</span> đang chờ xét duyệt.</p>
                             </div>
                           </div>
                         )}
                         {unreadChatCount > 0 && (
                           <div onClick={() => { setActiveTab('chat'); setShowNotif(false); }} className="p-4 hover:bg-green-50 cursor-pointer flex gap-3 transition-colors">
                             <div className="p-2 bg-green-100 rounded-full h-fit"><MessageSquare size={18} className="text-green-600"/></div>
                             <div>
                               <p className="text-sm font-semibold text-gray-900">Hỗ trợ khách hàng</p>
                               <p className="text-xs text-gray-500 mt-0.5">Có <span className="font-bold text-green-600">{unreadChatCount} khách hàng</span> đang chờ bạn phản hồi.</p>
                             </div>
                           </div>
                         )}
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div 
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-300"
              title="Đăng xuất"
            >
              AD
            </div>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}