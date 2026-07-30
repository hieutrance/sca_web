import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, User, Send, Search, Clock, Info } from 'lucide-react';
import { ref, onValue, push, set, update } from 'firebase/database';
import { db } from '../services/firebase';

export default function ChatSupport() {
  const [chatRooms, setChatRooms] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);

  // 1. Lấy danh sách tất cả các phòng Chat
  useEffect(() => {
    const chatsRef = ref(db, 'Chats');
    const unsub = onValue(chatsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rooms = Object.keys(data).map(key => ({
          id: key,
          ...data[key].meta // Lấy thông tin meta (tên, sđt, tin nhắn cuối)
        }));
        // Sắp xếp: Phòng có tin nhắn mới nhất lên đầu
        rooms.sort((a, b) => new Date(b.last_update || 0) - new Date(a.last_update || 0));
        setChatRooms(rooms);
      } else {
        setChatRooms([]);
      }
    });
    return () => unsub();
  }, []);

  // 2. Lấy nội dung tin nhắn khi chọn 1 phòng Chat
  useEffect(() => {
    if (!activeChat) return;

    const messagesRef = ref(db, `Chats/${activeChat.id}/messages`);
    const unsub = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        msgList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMessages(msgList);
      } else {
        setMessages([]);
      }
      // Tự động cuộn xuống cuối
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Đánh dấu là Admin đã đọc tin nhắn
    update(ref(db, `Chats/${activeChat.id}/meta`), { unread_admin: false });

    return () => unsub();
  }, [activeChat]);

  // 3. Hàm Gửi tin nhắn từ Admin
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const newMessage = {
      text: inputText.trim(),
      sender: 'admin',
      timestamp: new Date().toISOString()
    };

    try {
      setInputText('');
      
      // Đẩy tin nhắn vào danh sách
      await push(ref(db, `Chats/${activeChat.id}/messages`), newMessage);
      
      // Cập nhật lại thông tin phòng chat
      await update(ref(db, `Chats/${activeChat.id}/meta`), {
        last_message: newMessage.text,
        last_update: newMessage.timestamp,
        unread_admin: false
      });
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
    }
  };

  // Lọc tìm kiếm
  const filteredRooms = chatRooms.filter(room => 
    room.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    room.customer_phone?.includes(searchTerm)
  );

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden animate-in fade-in duration-300">
      
      {/* CỘT TRÁI: DANH SÁCH KHÁCH HÀNG */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 h-full">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="text-blue-600" size={24} /> Chat Hỗ Trợ
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm khách hàng..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Chưa có cuộc hội thoại nào.</div>
          ) : (
            filteredRooms.map(room => {
              const isActive = activeChat?.id === room.id;
              const isUnread = room.unread_admin;
              
              return (
                <div 
                  key={room.id} 
                  onClick={() => setActiveChat(room)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors relative flex gap-3 ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-100 bg-white border-l-4 border-l-transparent'}`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {room.customer_name ? room.customer_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    {isUnread && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className={`text-sm truncate pr-2 ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {room.customer_name || room.id}
                      </h4>
                      {room.last_update && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(room.last_update).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${isUnread ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                      {room.last_message || 'Bắt đầu trò chuyện'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CỘT PHẢI: KHUNG CHAT CHI TIẾT */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative">
        {activeChat ? (
          <>
            {/* Header phòng chat */}
            <div className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  {activeChat.customer_name ? activeChat.customer_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{activeChat.customer_name || activeChat.id}</h3>
                  <p className="text-xs text-gray-500">{activeChat.customer_phone || 'Khách hàng'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Đang kết nối
              </div>
            </div>

            {/* Vùng hiển thị tin nhắn */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <MessageSquare size={48} className="mb-4 text-gray-300" />
                  <p>Hãy gửi lời chào đến khách hàng!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div key={msg.id || index} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm ${isAdmin ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'}`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={`text-[10px] mt-1 text-right ${isAdmin ? 'text-blue-200' : 'text-gray-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {/* Dummy div để cuộn xuống cuối */}
              <div ref={messagesEndRef} />
            </div>

            {/* Form nhập tin nhắn */}
            <div className="p-4 bg-white border-t border-gray-200 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Nhập phản hồi của bạn..."
                  className="flex-1 bg-gray-100 border-transparent rounded-full px-6 py-3 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim()}
                  className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <Send size={20} className="ml-1" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 h-full">
            <MessageSquare size={64} className="mb-4 text-gray-200" />
            <h3 className="text-lg font-medium text-gray-500">Chưa chọn đoạn chat nào</h3>
            <p className="text-sm mt-1">Chọn một khách hàng ở cột bên trái để bắt đầu hỗ trợ</p>
          </div>
        )}
      </div>
    </div>
  );
}