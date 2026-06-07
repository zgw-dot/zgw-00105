import { useAppStore } from '@/store';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  visible?: boolean;
}

export const LoadingOverlay = ({ visible }: LoadingOverlayProps = {}) => {
  const { loading } = useAppStore();
  const isVisible = visible !== undefined ? visible : loading;

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-gray-700 font-medium">处理中，请稍候...</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
