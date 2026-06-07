import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { importApi, mappingApi, analyzeApi, rulesApi } from '@/utils/api';
import { FileUploadCard } from '@/components/import/FileUploadCard';
import { Database, ArrowRight, Play, Download, FileJson } from 'lucide-react';
import type { RunHistory } from '../../shared';

export const ImportPage = () => {
  const navigate = useNavigate();
  const {
    uploadedFiles,
    currentMappingId,
    currentRules,
    setLoading,
    showNotification,
    setFieldMappings,
    setCurrentMappingId,
    setCurrentRules,
    setRulesVersions,
    setCurrentRun,
    setCurrentAnomalies,
    setCurrentBadRows,
    setPreviousRun,
    setComparison,
    setRunHistory,
    setUploadedFile,
  } = useAppStore();

  const allUploaded = uploadedFiles.order && uploadedFiles.return && uploadedFiles.quality;

  const handleLoadSampleData = async () => {
    setLoading(true);
    try {
      const result = await importApi.getSampleData();
      
      if (result.success) {
        let mappingId: string | undefined;
        let rulesId: string | undefined;
        let savedMappings: any = null;

        const autoMapResult = await mappingApi.autoMap({
          orderColumns: result.order.columns,
          returnColumns: result.return.columns,
          qualityColumns: result.quality.columns,
        });

        if (autoMapResult.success) {
          const mappings = await mappingApi.getMappings();
          if (mappings.success) {
            savedMappings = mappings;
            setFieldMappings(mappings.savedMappings);
          }

          const saveMappingResult = await mappingApi.saveMapping({
            name: `示例数据映射_${new Date().toLocaleDateString()}`,
            mapping: autoMapResult.mapping,
          });

          if (saveMappingResult.success) {
            mappingId = saveMappingResult.mappingId;
            setCurrentMappingId(saveMappingResult.mappingId);
          }
        }

        const rulesResult = await rulesApi.getRules();
        if (rulesResult.success) {
          setCurrentRules(rulesResult.currentRules);
          setRulesVersions(rulesResult.history);
        }

        if (!mappingId && savedMappings?.savedMappings?.[0]) {
          const firstMapping = savedMappings.savedMappings[0];
          mappingId = firstMapping.id;
          setCurrentMappingId(firstMapping.id);
        }

        const saveRulesResult = await rulesApi.saveRules({
          rules: currentRules || {
            overdueDays: 15,
            duplicateReturnWindow: 30,
            qualityConflictTypes: ['性能故障', '外观瑕疵', '包装问题'],
            enableAutoIsolate: true,
          },
        });
        rulesId = saveRulesResult.rulesId;

        const [orderFile, returnFile, qualityFile] = await Promise.all([
          importApi.saveFile({
            fileType: 'order',
            fileName: 'sample_orders.csv',
            data: result.order.data,
            columns: result.order.columns,
          }),
          importApi.saveFile({
            fileType: 'return',
            fileName: 'sample_returns.csv',
            data: result.return.data,
            columns: result.return.columns,
          }),
          importApi.saveFile({
            fileType: 'quality',
            fileName: 'sample_quality.csv',
            data: result.quality.data,
            columns: result.quality.columns,
          }),
        ]);

        setUploadedFile('order', {
          fileId: orderFile.fileId,
          fileType: 'order',
          fileName: orderFile.fileName,
          columns: result.order.columns,
          data: result.order.data,
          preview: result.order.preview,
          rowCount: result.order.data.length,
        });
        setUploadedFile('return', {
          fileId: returnFile.fileId,
          fileType: 'return',
          fileName: returnFile.fileName,
          columns: result.return.columns,
          data: result.return.data,
          preview: result.return.preview,
          rowCount: result.return.data.length,
        });
        setUploadedFile('quality', {
          fileId: qualityFile.fileId,
          fileType: 'quality',
          fileName: qualityFile.fileName,
          columns: result.quality.columns,
          data: result.quality.data,
          preview: result.quality.preview,
          rowCount: result.quality.data.length,
        });

        showNotification('示例数据加载成功', 'success');

        if (mappingId && rulesId) {
          const analyzeResult = await analyzeApi.runAnalysis({
            mappingId,
            rulesId,
            orderFileId: orderFile.fileId,
            returnFileId: returnFile.fileId,
            qualityFileId: qualityFile.fileId,
          });

          if (analyzeResult.success) {
            const runData: RunHistory = {
              id: analyzeResult.runId,
              mappingId,
              rulesId,
              files: {
                order: { fileId: orderFile.fileId, fileName: orderFile.fileName, rowCount: result.order.data.length },
                return: { fileId: returnFile.fileId, fileName: returnFile.fileName, rowCount: result.return.data.length },
                quality: { fileId: qualityFile.fileId, fileName: qualityFile.fileName, rowCount: result.quality.data.length },
              },
              summary: analyzeResult.summary,
              status: analyzeResult.badRows.length > 0 ? 'partial' : 'completed',
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            };
            setCurrentRun(runData);
            setCurrentAnomalies(analyzeResult.anomalies);
            setCurrentBadRows(analyzeResult.badRows);

            const history = await analyzeApi.getHistory();
            if (history.success) {
              setRunHistory(history.runs);
              if (history.runs.length >= 2) {
                setPreviousRun(history.runs[1]);
                const compare = await analyzeApi.compareRuns(
                  history.runs[0].id,
                  history.runs[1].id
                );
                if (compare.success) {
                  setComparison(compare.diff);
                }
              }
            }

            showNotification('分析完成！已检测到 ' + analyzeResult.summary.totalAnomalies + ' 个异常', 'success');
            navigate('/');
          }
        }
      }
    } catch (error: any) {
      showNotification(error.message || '加载示例数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAndSave = async () => {
    if (!allUploaded) return;
    
    setLoading(true);
    try {
      const autoMapResult = await mappingApi.autoMap({
        orderColumns: uploadedFiles.order!.columns,
        returnColumns: uploadedFiles.return!.columns,
        qualityColumns: uploadedFiles.quality!.columns,
      });

      if (autoMapResult.success) {
        const saveMappingResult = await mappingApi.saveMapping({
          name: `映射_${new Date().toLocaleDateString()}`,
          mapping: autoMapResult.mapping,
        });

        if (saveMappingResult.success) {
          setCurrentMappingId(saveMappingResult.mappingId);
          showNotification('字段映射已自动完成', 'success');
          navigate('/mapping');
        }
      }
    } catch (error: any) {
      showNotification(error.message || '处理失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">数据导入</h2>
            <p className="text-blue-100">
              上传订单、退货、质检三份 CSV 文件，系统将自动识别字段并进行异常分析
            </p>
          </div>
          <button
            onClick={handleLoadSampleData}
            className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg"
          >
            <Database className="w-5 h-5" />
            加载示例数据
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FileUploadCard
          fileType="order"
          title="订单表"
          description="包含订单编号、下单日期、客户ID、商品信息等"
        />
        <FileUploadCard
          fileType="return"
          title="退货表"
          description="包含退货单号、关联订单号、退货日期、退货原因等"
        />
        <FileUploadCard
          fileType="quality"
          title="质检表"
          description="包含质检单号、关联订单号、质检结果、缺陷类型等"
        />
      </div>

      {allUploaded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">数据已就绪</h3>
              <p className="text-sm text-gray-500 mt-1">
                共 {uploadedFiles.order!.rowCount + uploadedFiles.return!.rowCount + uploadedFiles.quality!.rowCount} 条记录待处理
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleValidateAndSave}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
                下一步：字段映射
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">数据格式说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-600">订单表必需字段</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 订单编号 (orderId)</li>
              <li>• 下单日期 (orderDate)</li>
              <li>• 客户ID (customerId)</li>
              <li>• 商品名称/ID (productId)</li>
              <li>• 订单金额 (amount)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-orange-600">退货表必需字段</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 退货单号 (returnId)</li>
              <li>• 关联订单号 (orderId)</li>
              <li>• 退货日期 (returnDate)</li>
              <li>• 退货原因 (reason)</li>
              <li>• 退货状态 (status)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-red-600">质检表必需字段</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 质检单号 (qualityId)</li>
              <li>• 关联订单号 (orderId)</li>
              <li>• 质检日期 (inspectDate)</li>
              <li>• 质检结果 (result)</li>
              <li>• 缺陷类型 (defectType)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
