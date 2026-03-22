import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  FileText, 
  Download, 
  Printer,
  Eye,
  Calendar
} from 'lucide-react';

const reportTypes = [
  { id: 'uaqtea', name: 'UAQTEA Enrollment Report - AY 2018-2026', description: 'CHED format compliance report with enrollment trends' },
  { id: 'tdp', name: 'TDP Beneficiary Report - 2019-2025', description: 'With decline analysis and trend projections' },
  { id: 'fhe-grad', name: 'FHE Graduates Master List - Batch 2020-2025', description: '1,517 graduates complete records' },
  { id: 'fhe-summer', name: 'FHE Summer Enrollment - 2018-2025', description: 'With pandemic impact notes and recovery analysis' },
  { id: 'private', name: 'Private Assistance Report - AY 2025-2026', description: '126 beneficiaries by program and benefactor' },
  { id: 'comparison', name: 'TES vs TDP Comparison', description: 'Trend analysis 2019-2025 with projections' },
];

const recentReports = [
  { name: 'UAQTEA_Enrollment_2018-2026.pdf', date: 'Feb 14, 2026', size: '3.2 MB', type: 'PDF' },
  { name: 'FHE_Graduates_Master_List_2020-2025.xlsx', date: 'Feb 12, 2026', size: '2.1 MB', type: 'Excel' },
  { name: 'TDP_Decline_Analysis_2019-2025.pdf', date: 'Feb 10, 2026', size: '1.8 MB', type: 'PDF' },
  { name: 'Private_Beneficiaries_AY2025-2026.csv', date: 'Feb 08, 2026', size: '156 KB', type: 'CSV' },
];

const sampleColumns = [
  'Student ID', 'Full Name', 'Program', 'Scholarship Type', 'Award Amount', 
  'Academic Year', 'Semester', 'GWA', 'Status', 'Date Approved'
];

export default function ReportGeneration() {
  const [selectedReport, setSelectedReport] = useState('tes');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [semester, setSemester] = useState('1st');
  const [programFilter, setProgramFilter] = useState('all');
  const [format, setFormat] = useState('pdf');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Generate Reports</h1>
        <p className="text-gray-600 mt-1">CHED/UniFAST Compliance & Custom Reports</p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Report Types */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Report Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reportTypes.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedReport === report.id
                      ? 'border-[#1E3A8A] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedReport === report.id ? 'bg-[#1E3A8A]' : 'bg-gray-100'
                    }`}>
                      <FileText className={`w-5 h-5 ${
                        selectedReport === report.id ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{report.name}</h3>
                      <p className="text-sm text-gray-600">{report.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Report Configuration */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Academic Year */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Academic Year
              </label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-2026">2025-2026</SelectItem>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>
                  <SelectItem value="2023-2024">2023-2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Semester */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Semester
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['1st', '2nd', 'Summer'].map((sem) => (
                  <button
                    key={sem}
                    onClick={() => setSemester(sem)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      semester === sem
                        ? 'bg-[#1E3A8A] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {sem}
                  </button>
                ))}
              </div>
            </div>

            {/* Program Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Program Filter
              </label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  <SelectItem value="tes">TES Only</SelectItem>
                  <SelectItem value="tdp">TDP Only</SelectItem>
                  <SelectItem value="private">Private Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input type="date" defaultValue="2025-08-01" />
                  <p className="text-xs text-gray-500 mt-1">From</p>
                </div>
                <div>
                  <Input type="date" defaultValue="2026-02-14" />
                  <p className="text-xs text-gray-500 mt-1">To</p>
                </div>
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'pdf', label: 'PDF' },
                  { value: 'excel', label: 'Excel' },
                  { value: 'csv', label: 'CSV' }
                ].map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setFormat(fmt.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      format === fmt.value
                        ? 'bg-[#1E3A8A] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Report Preview</CardTitle>
          <Badge className="bg-blue-100 text-blue-800">
            <Calendar className="w-3 h-3 mr-1" />
            1,280 records
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white border-b-2 border-gray-200">
                  <tr>
                    {sampleColumns.map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-sm font-bold text-gray-900 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((row) => (
                    <tr key={row} className="border-b border-gray-100">
                      {sampleColumns.map((col, idx) => (
                        <td key={idx} className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          Sample Data
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-center text-gray-500 text-sm mt-4">
              Preview showing first 3 rows of {sampleColumns.length} columns
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button className="flex-1 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white h-14 text-lg font-bold">
          <FileText className="w-5 h-5 mr-2" />
          GENERATE REPORT
        </Button>
        <Button variant="outline" className="h-14 px-8">
          <Download className="w-5 h-5 mr-2" />
          EXPORT
        </Button>
        <Button variant="outline" className="h-14 px-8">
          <Printer className="w-5 h-5 mr-2" />
          PRINT
        </Button>
      </div>

      {/* Recent Reports */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentReports.map((report, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#1E3A8A]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{report.name}</h4>
                    <p className="text-sm text-gray-500">
                      {report.date} • {report.size} • {report.type}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}