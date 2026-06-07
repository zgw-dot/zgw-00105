import { useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { importApi, mappingApi } from '@/utils/api';
import { Upload, FileSpreadsheet, Check, AlertTriangle, X } from 'lucide-react';
import type { FileType } from '../../../shared';

interface FileUploadCardProps {
  fileType: FileType;
  title: string;
  description: string;
}

const fileTypeLabels: Record<FileType, string> = {
  order: '订单表',
  return: '退货表',
  quality: '质检表',
};

export const FileUploadCard = ({ fileType, title, description }: FileUploadCardProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { uploadedFiles, setUploadedFile, setLoading, showNotification } = useAppStore();
  const uploaded = uploadedFiles[fileType];

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      showNotification('请上传 CSV 格式文件', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await importApi.uploadFile(fileType, file);
      
      if (!result.success) {
        showNotification(result.error || '上传失败', 'error');
        return;
      }

      setUploadedFile(fileType, {
        fileId: result.fileId,
        fileType: result.fileType,
        fileName: result.fileName,
        columns: result.columns,
        data: result.data,
        preview: result.preview,
        rowCount: result.rowCount,
      });

      showNotification(`${fileTypeLabels[fileType]} 上传成功`, 'success');
    } catch (error: any) {
      showNotification(error.message || '上传失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = () => {
    setUploadedFile(fileType, null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      
      <div className="p-6">
        {uploaded ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">{uploaded.fileName}</p>
                  <p className="text-sm text-green-600">
                    {uploaded.rowCount} 行数据 · {uploaded.columns.length} 列
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemove}
                className="p-2 hover:bg-green-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-green-600" />
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">列名预览</p>
              <div className="flex flex-wrap gap-2">
                {uploaded.columns.slice(0, 6).map((col) => (
                  <span
                    key={col}
                    className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600"
                  >
                    {col}
                  </span>
                ))}
                {uploaded.columns.length > 6 && (
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
                    +{uploaded.columns.length - 6} 更多
                  </span>
                )}
              </div>
            </div>

            {uploaded.errors && uploaded.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">
                    发现 {uploaded.errors.length} 个数据问题
                  </p>
                </div>
                <p className="text-xs text-amber-600">
                  部分行可能存在格式问题，将在后续步骤中自动隔离
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-700 font-medium">拖拽文件到此处</p>
            <p className="text-gray-500 text-sm mt-1">或点击选择 CSV 文件</p>
            <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Upload className="w-4 h-4" />
              选择文件
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
