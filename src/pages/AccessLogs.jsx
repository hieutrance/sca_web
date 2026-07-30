import React from 'react';
import { Activity, Clock } from 'lucide-react';

export default function AccessLogs() {
  return (
    <div className="p-8 bg-white h-full overflow-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Nhật Ký Hệ Thống</h2>
        <p className="text-sm text-gray-500">Truy vết mọi sự kiện mở cửa và kết nối từ thiết bị.</p>
      </div>

      <div className="space-y-4 max-w-4xl">
        <div className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50">
          <div className="p-2 bg-teal-100 text-teal-600 rounded-full mt-1"><Activity size={16} /></div>
          <div>
            <p className="font-medium text-gray-900">Mở cửa thành công (UWB Ranging)</p>
            <p className="text-sm text-gray-500">Xe: 51K-999.99 | Người mở: Trần Thị B</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <Clock size={12} /> Vài giây trước
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 border border-pink-100 rounded-xl bg-pink-50/30">
          <div className="p-2 bg-pink-100 text-pink-600 rounded-full mt-1"><Activity size={16} /></div>
          <div>
            <p className="font-medium text-gray-900">Cảnh báo: Khách mở cửa khi đã quá hạn</p>
            <p className="text-sm text-gray-500">Xe: 51K-999.99 | Hệ thống đã kích hoạt còi bíp</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <Clock size={12} /> 10 phút trước
          </div>
        </div>
      </div>
    </div>
  );
}