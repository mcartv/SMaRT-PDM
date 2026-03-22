import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Users, 
  GraduationCap, 
  TrendingUp,
  TrendingDown,
  Download,
  AlertCircle,
  Award
} from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';

// Real data from Pambayang Dalubhasaan ng Marilao
const statsCards = [
  { 
    title: 'UAQTEA Beneficiaries AY 2025-2026', 
    value: '2,418', 
    subtitle: '1st Semester',
    icon: Users, 
    color: 'text-[#1E3A8A]',
    bgColor: 'bg-blue-50',
    trend: '+15.9%',
    trendUp: true
  },
  { 
    title: 'TDP Scholars AY 2024-2025', 
    value: '24', 
    subtitle: '15 1st sem + 9 2nd sem',
    icon: Award, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    trend: '-71.1%',
    trendUp: false
  },
  { 
    title: 'FHE Graduates (2020-2025)', 
    value: '1,517', 
    subtitle: 'Cumulative',
    icon: GraduationCap, 
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    trend: 'Total',
    trendUp: true
  },
  { 
    title: 'Private Beneficiaries AY 2025-2026', 
    value: '126', 
    subtitle: '1st Semester',
    icon: Users, 
    color: 'text-[#0D9488]',
    bgColor: 'bg-teal-50',
    trend: 'New',
    trendUp: true
  },
];

// UAQTEA Enrollment Data (2018-2026)
const uaqteaData = [
  { year: '2018-2019', sem1: 1473, sem2: 1441 },
  { year: '2019-2020', sem1: 1523, sem2: 1390 },
  { year: '2020-2021', sem1: 1630, sem2: 1468 },
  { year: '2021-2022', sem1: 1654, sem2: 1565 },
  { year: '2022-2023', sem1: 1727, sem2: 1685 },
  { year: '2023-2024', sem1: 1876, sem2: 1750 },
  { year: '2024-2025', sem1: 2087, sem2: 1966 },
  { year: '2025-2026', sem1: 2418, sem2: null },
];

// TDP Beneficiaries Data (2019-2025)
const tdpData = [
  { year: '2019-2020', sem1: 138, sem2: 128 },
  { year: '2020-2021', sem1: 154, sem2: 167 },
  { year: '2021-2022', sem1: 196, sem2: 190 },
  { year: '2022-2023', sem1: 105, sem2: 95 },
  { year: '2023-2024', sem1: 46, sem2: 37 },
  { year: '2024-2025', sem1: 15, sem2: 9 },
];

// FHE Graduates Data (2020-2025)
const fheGraduatesData = [
  { batch: '2020', graduates: 160 },
  { batch: '2021', graduates: 134 },
  { batch: '2022', graduates: 268 },
  { batch: '2023', graduates: 382 },
  { batch: '2024', graduates: 279 },
  { batch: '2025', graduates: 294 },
];

// FHE Summer Enrollment
const fheSummerData = [
  { year: '2018-2019', enrolled: 162 },
  { year: '2019-2020', enrolled: 0, pandemic: true },
  { year: '2020-2021', enrolled: 0, pandemic: true },
  { year: '2021-2022', enrolled: 0, pandemic: true },
  { year: '2022-2023', enrolled: 125 },
  { year: '2023-2024', enrolled: 162 },
  { year: '2024-2025', enrolled: 240 },
];

// Financial Assistance Beneficiaries by Degree Program
const fabByProgram = [
  { program: 'BECED', bcPkg: 1, foodCraft: 3, genmart: 1, kaizen: 16, total: 21 },
  { program: 'BSCS', bcPkg: 0, foodCraft: 0, genmart: 0, kaizen: 11, total: 11 },
  { program: 'BSHM', bcPkg: 1, foodCraft: 2, genmart: 2, kaizen: 10, total: 13 },
  { program: 'BSIT', bcPkg: 2, foodCraft: 2, genmart: 6, kaizen: 24, total: 34 },
  { program: 'BSOA', bcPkg: 0, foodCraft: 2, genmart: 3, kaizen: 5, total: 10 },
  { program: 'BSTM', bcPkg: 1, foodCraft: 2, genmart: 3, kaizen: 23, total: 29 },
  { program: 'BTLED', bcPkg: 0, foodCraft: 1, genmart: 0, kaizen: 7, total: 8 },
];

// Distribution by Benefactor (for pie chart)
const benefactorDistribution = [
  { name: 'BC Packaging', value: 5, percentage: 4, color: '#FBBF24' },
  { name: 'Food Crafters', value: 10, percentage: 8, color: '#EF4444' },
  { name: 'Genmart', value: 15, percentage: 12, color: '#1E3A8A' },
  { name: 'Kaizen', value: 96, percentage: 76, color: '#6B7280' },
];

// Insight cards
const insights = [
  { 
    title: 'UAQTEA Growth', 
    value: '64%', 
    description: 'Enrollment grew from 1,473 (2018) to 2,418 (2025)',
    color: 'bg-blue-100 border-blue-300 text-blue-900'
  },
  { 
    title: 'TDP Decline', 
    value: '94%', 
    description: 'Decreased from peak 386 (2021-22) to 24 (2024-25)',
    color: 'bg-orange-100 border-orange-300 text-orange-900'
  },
  { 
    title: 'FHE Peak', 
    value: '382', 
    description: 'Highest graduates in 2023 batch',
    color: 'bg-green-100 border-green-300 text-green-900'
  },
  { 
    title: 'Kaizen Dominance', 
    value: '76%', 
    description: 'Supports 96 of 126 private beneficiaries',
    color: 'bg-teal-100 border-teal-300 text-teal-900'
  },
  { 
    title: 'BSIT Leading', 
    value: '34', 
    description: 'Highest private assistance beneficiaries',
    color: 'bg-purple-100 border-purple-300 text-purple-900'
  },
  { 
    title: 'Post-Pandemic Recovery', 
    value: '240', 
    description: 'FHE Summer enrollment from 0 (2021) to 240 (2025)',
    color: 'bg-indigo-100 border-indigo-300 text-indigo-900'
  },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Good morning, Ms. Dela Cruz</h1>
        <p className="text-gray-600 mt-1">Pambayang Dalubhasaan ng Marilao - Scholarship Overview AY 2025-2026</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 font-medium uppercase">{stat.title}</p>
                  <h3 className="text-4xl font-bold text-gray-900 mt-2">{stat.value}</h3>
                  <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {stat.trendUp ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* UAQTEA Enrollment Chart - Large */}
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>RA 10931 Universal Access to Quality Tertiary Education Act (UAQTEA)</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Enrollment Trends 2018-2026</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={uaqteaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                domain={[0, 2500]} 
                ticks={[0, 500, 1000, 1500, 2000, 2500]}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="sem1" fill="#1E3A8A" name="1st Semester" radius={[8, 8, 0, 0]} />
              <Bar dataKey="sem2" fill="#0D9488" name="2nd Semester" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-center">
            <Badge className="bg-blue-100 text-blue-800">
              Current: 2,418 students (1st Semester AY 2025-2026)
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row - TDP and FHE Graduates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TDP Chart */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Tulong Dunong Program (TDP) Beneficiaries</CardTitle>
            <p className="text-sm text-gray-600">2019-2025 Trend Analysis</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tdpData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis domain={[0, 250]} ticks={[0, 50, 100, 150, 200, 250]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sem1" fill="#3B82F6" name="1st Sem" />
                <Bar dataKey="sem2" fill="#F59E0B" name="2nd Sem" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-600 font-medium">Program decline 88% over 3 years</p>
            </div>
          </CardContent>
        </Card>

        {/* FHE Graduates Chart */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Free Higher Education (FHE) Graduates</CardTitle>
            <p className="text-sm text-gray-600">Batch 2020-2025</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fheGraduatesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="batch" />
                <YAxis domain={[0, 400]} ticks={[0, 100, 200, 300, 400]} />
                <Tooltip />
                <Bar dataKey="graduates" fill="#10B981" radius={[8, 8, 0, 0]}>
                  {fheGraduatesData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.batch === '2023' ? '#FBBF24' : '#10B981'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <Badge className="bg-green-100 text-green-800 text-lg px-4 py-2">
                Total Graduates: 1,517
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - FHE Summer and Private Beneficiaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FHE Summer Enrollment */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Free Higher Education - Summer Enrollment</CardTitle>
            <p className="text-sm text-gray-600">2018-2025 with Pandemic Impact</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fheSummerData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis domain={[0, 250]} ticks={[0, 50, 100, 150, 200, 250]} />
                <Tooltip />
                <Bar dataKey="enrolled" radius={[8, 8, 0, 0]}>
                  {fheSummerData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.pandemic ? '#EF4444' : '#1E3A8A'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <Badge className="bg-red-100 text-red-800">
                PANDEMIC: 2019-2022 (Zero Enrollment)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Private Beneficiaries Distribution */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Distribution by Benefactor</CardTitle>
            <p className="text-sm text-gray-600">AY 2025-2026 (126 Total)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={benefactorDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${entry.value} (${entry.percentage}%)`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {benefactorDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Financial Assistance Table */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Financial Assistance Beneficiaries - First Semester AY 2025-2026</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Degree Program</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">BC Packaging</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Food Crafters</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Genmart</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Kaizen</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-blue-50">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fabByProgram.map((row, index) => (
                  <tr key={row.program} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.program}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{row.bcPkg || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{row.foodCraft || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{row.genmart || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{row.kaizen}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900 bg-blue-50">{row.total}</td>
                  </tr>
                ))}
                <tr className="bg-blue-100 font-bold">
                  <td className="px-4 py-3 text-gray-900">TOTAL</td>
                  <td className="px-4 py-3 text-center text-gray-900">5</td>
                  <td className="px-4 py-3 text-center text-gray-900">10</td>
                  <td className="px-4 py-3 text-center text-gray-900">15</td>
                  <td className="px-4 py-3 text-center text-gray-900">96</td>
                  <td className="px-4 py-3 text-center text-gray-900 bg-blue-200">126</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data Insights */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Key Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight) => (
            <Card key={insight.title} className={`shadow-md border-2 ${insight.color}`}>
              <CardContent className="p-6">
                <h3 className="text-sm font-medium uppercase mb-2">{insight.title}</h3>
                <p className="text-3xl font-bold mb-2">{insight.value}</p>
                <p className="text-sm">{insight.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-gray-500 border-t border-gray-200">
        <p>Last Updated: Based on OSFA Records AY 2025-2026</p>
        <p className="mt-1">Source: OSFA PDM Records 2025 • Pambayang Dalubhasaan ng Marilao</p>
      </div>
    </div>
  );
}
