import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  User,
  Calendar,
  Building2
} from 'lucide-react';

const pendingROs = [
  {
    id: 'RO-001',
    student: { name: 'Juan Dela Cruz', id: 'S2023-001', program: 'TES' },
    obligation: 'Community Service - Library',
    type: 'Community Service',
    submitted: 'Oct 28, 2025',
    document: 'certificate_library.pdf',
    department: 'Library',
    hours: '40 hours',
  },
  {
    id: 'RO-002',
    student: { name: 'Maria Santos', id: 'S2023-002', program: 'TDP' },
    obligation: 'Tutorial Program - Mathematics',
    type: 'Tutorial Service',
    submitted: 'Oct 27, 2025',
    document: 'tutorial_completion.pdf',
    department: 'Mathematics Dept',
    hours: '30 hours',
  },
  {
    id: 'RO-003',
    student: { name: 'Ana Reyes', id: 'S2023-003', program: 'TES' },
    obligation: 'Campus Cleanup Drive',
    type: 'Community Service',
    submitted: 'Oct 26, 2025',
    document: 'cleanup_certificate.pdf',
    department: 'Facilities',
    hours: '20 hours',
  },
];

const verifiedROs = [
  {
    id: 'RO-124',
    student: { name: 'Pedro Garcia', id: 'S2023-004', program: 'Private' },
    obligation: 'Library Organization',
    verifiedBy: 'Ms. Cruz (Library Head)',
    verifiedDate: 'Oct 25, 2025',
  },
  {
    id: 'RO-123',
    student: { name: 'Rosa Lopez', id: 'S2023-005', program: 'TES' },
    obligation: 'Math Tutorial Sessions',
    verifiedBy: 'Dr. Santos (Math Dept)',
    verifiedDate: 'Oct 24, 2025',
  },
];

const overdueROs = [
  {
    id: 'RO-OVER-001',
    student: { name: 'Carlos Martinez', id: 'S2023-006', program: 'TDP' },
    obligation: 'Community Service - Required',
    dueDate: 'Oct 15, 2025',
    daysOverdue: 14,
  },
  {
    id: 'RO-OVER-002',
    student: { name: 'Lisa Fernandez', id: 'S2023-007', program: 'TES' },
    obligation: 'Tutorial Program',
    dueDate: 'Oct 10, 2025',
    daysOverdue: 19,
  },
];

export default function ROAdmin() {
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Return of Obligations Verification</h1>
        <p className="text-gray-600 mt-1">Manage and verify scholar return obligations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Verification</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">16</p>
              </div>
              <Clock className="w-10 h-10 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Verified</p>
                <p className="text-3xl font-bold text-green-600 mt-1">124</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600 mt-1">3</p>
              </div>
              <XCircle className="w-10 h-10 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">89%</p>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-blue-600 flex items-center justify-center opacity-20">
                <span className="text-xs font-bold text-blue-600">%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="pending" className="relative">
            Pending Verification
            <Badge className="ml-2 bg-orange-500 text-white">16</Badge>
          </TabsTrigger>
          <TabsTrigger value="verified">
            Verified
            <Badge className="ml-2 bg-green-500 text-white">124</Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            <Badge className="ml-2 bg-red-500 text-white">3</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingROs.map((ro) => (
            <Card key={ro.id} className="shadow-md">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Section - Student Info */}
                  <div className="lg:col-span-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-[#1E3A8A] text-white">
                          {ro.student.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{ro.student.name}</h3>
                        <p className="text-sm text-gray-500">{ro.student.id}</p>
                        <Badge className="mt-2 bg-blue-100 text-blue-800">{ro.student.program}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section - Obligation Details */}
                  <div className="lg:col-span-5 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Obligation</p>
                      <p className="text-sm font-bold text-gray-900">{ro.obligation}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Submitted
                        </p>
                        <p className="text-sm text-gray-900">{ro.submitted}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          Department
                        </p>
                        <p className="text-sm text-gray-900">{ro.department}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Document
                      </p>
                      <p className="text-sm text-blue-600 hover:underline cursor-pointer">{ro.document}</p>
                    </div>
                  </div>

                  {/* Right Section - Actions */}
                  <div className="lg:col-span-3 flex flex-col gap-2">
                    <Button className="bg-[#10B981] hover:bg-[#10B981]/90 text-white">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      APPROVE
                    </Button>
                    <Button variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
                      <XCircle className="w-4 h-4 mr-2" />
                      REJECT
                    </Button>
                    <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                      <User className="w-4 h-4 mr-2" />
                      ASSIGN TO DEPT HEAD
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Department Head View Simulation */}
          <Card className="shadow-md border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Department Head View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Filtered view for department heads showing only obligations assigned to their department
              </p>
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-200">
                <div>
                  <p className="font-medium text-gray-900">Pending my approval: 2 items</p>
                  <p className="text-sm text-gray-500">Library Department</p>
                </div>
                <Button size="sm" className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  VERIFY
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verified Tab */}
        <TabsContent value="verified" className="space-y-4 mt-6">
          {verifiedROs.map((ro) => (
            <Card key={ro.id} className="shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-900">{ro.student.name}</h3>
                        <Badge className="bg-blue-100 text-blue-800">{ro.student.program}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{ro.obligation}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Verified by: {ro.verifiedBy}</span>
                        <span>•</span>
                        <span>{ro.verifiedDate}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">VERIFIED</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Overdue Tab */}
        <TabsContent value="overdue" className="space-y-4 mt-6">
          {overdueROs.map((ro) => (
            <Card key={ro.id} className="shadow-md border-2 border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-900">{ro.student.name}</h3>
                        <Badge className="bg-blue-100 text-blue-800">{ro.student.program}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{ro.obligation}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Due: {ro.dueDate}</span>
                        <span>•</span>
                        <span className="text-red-600 font-bold">{ro.daysOverdue} days overdue</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge className="bg-red-600 text-white">OVERDUE</Badge>
                    <Button size="sm" variant="outline" className="text-xs">
                      Send Reminder
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
