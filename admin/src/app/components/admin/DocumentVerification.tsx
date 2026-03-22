import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft,
  FileText,
  Flag
} from 'lucide-react';

const documents = [
  { id: 'cor', name: 'Certificate of Registration', status: 'verified', uploadedDate: 'Oct 20, 2025' },
  { id: 'grades', name: 'Grade Form', status: 'pending', uploadedDate: 'Oct 20, 2025' },
  { id: 'indigency', name: 'Certificate of Indigency', status: 'verified', uploadedDate: 'Oct 19, 2025' },
  { id: 'id', name: 'Valid ID', status: 'verified', uploadedDate: 'Oct 20, 2025' },
];

const studentInfo = {
  id: '2025-001',
  name: 'Juan Dela Cruz',
  program: 'TES',
  email: 'juan.delacruz@student.edu.ph',
  phone: '+63 912 345 6789',
  yearLevel: '2nd Year',
  course: 'BS Computer Science',
  department: 'Engineering',
  gwa: '1.75'
};

export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedDoc, setSelectedDoc] = useState('cor');
  const [comment, setComment] = useState('');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/admin/applications')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
          <p className="text-gray-600 mt-1">Application ID: {id}</p>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel - Application Summary (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Info Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar and Basic Info */}
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-[#1E3A8A] text-white text-xl">JD</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{studentInfo.name}</h3>
                  <p className="text-sm text-gray-600">{studentInfo.id}</p>
                  <Badge className="mt-2 bg-blue-100 text-blue-800">{studentInfo.program}</Badge>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="text-sm text-gray-900">{studentInfo.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Phone</p>
                  <p className="text-sm text-gray-900">{studentInfo.phone}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Year Level</p>
                    <p className="text-sm text-gray-900">{studentInfo.yearLevel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">GWA</p>
                    <p className="text-sm text-gray-900 font-bold">{studentInfo.gwa}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Course</p>
                  <p className="text-sm text-gray-900">{studentInfo.course}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Department</p>
                  <p className="text-sm text-gray-900">{studentInfo.department}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Checklist */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Required Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                      selectedDoc === doc.id 
                        ? 'border-[#1E3A8A] bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(doc.status)}
                      <div className="text-left">
                        <p className="font-medium text-sm text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">Uploaded: {doc.uploadedDate}</p>
                      </div>
                    </div>
                    <FileText className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>

              {/* Progress */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Verification Progress</span>
                  <span className="font-bold text-gray-900">75%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-[#10B981] h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Document Viewer (60%) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Document Tabs */}
          <Card className="shadow-md">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedDoc === doc.id
                        ? 'bg-[#1E3A8A] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {doc.name}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* PDF Viewer Simulation */}
              <div className="bg-gray-100 p-8 min-h-[500px] flex items-center justify-center">
                <div className="bg-white shadow-lg w-full max-w-2xl p-12 rounded-lg">
                  <div className="text-center space-y-4">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto" />
                    <h3 className="text-xl font-bold text-gray-900">
                      {documents.find(d => d.id === selectedDoc)?.name}
                    </h3>
                    <p className="text-gray-600">Document Preview</p>
                    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                      <p className="text-gray-400">PDF Document Content</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Actions */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Verification Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comment Box */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Add note to student (optional)
                </label>
                <Textarea
                  placeholder="Enter any comments or instructions for the student..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button className="bg-[#10B981] hover:bg-[#10B981]/90 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Verified
                </Button>
                <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                  <XCircle className="w-4 h-4 mr-2" />
                  Request Re-upload
                </Button>
                <Button variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
                  <Flag className="w-4 h-4 mr-2" />
                  Flag for Review
                </Button>
              </div>

              {/* Save & Next */}
              <Button className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white h-12 text-lg font-bold">
                SAVE & NEXT
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
