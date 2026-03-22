import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Send,
  Eye,
  Calendar,
  Users
} from 'lucide-react';

const existingAnnouncements = [
  {
    id: 1,
    title: 'TES Deadline Extended',
    content: 'The deadline for TES applications has been extended to March 15, 2026. Please ensure all documents are submitted before the new deadline.',
    status: 'Published',
    publishedDate: 'Oct 25, 2025',
    audience: 'New Applicants',
    views: 342
  },
  {
    id: 2,
    title: 'New Scholarship: BC Packaging',
    content: 'We are pleased to announce a new scholarship opportunity from BC Packaging Corporation for Engineering students.',
    status: 'Draft',
    publishedDate: null,
    audience: 'All Students',
    views: 0
  },
  {
    id: 3,
    title: 'Return of Obligations Reminder',
    content: 'All scholars are reminded to complete their return of obligations before the end of the semester.',
    status: 'Published',
    publishedDate: 'Oct 20, 2025',
    audience: 'Current Scholars',
    views: 589
  },
  {
    id: 4,
    title: 'Scholarship Disbursement Schedule',
    content: 'The scholarship allowances for this semester will be released on March 15, 2026. Please ensure your bank details are updated.',
    status: 'Scheduled',
    publishedDate: 'Mar 01, 2026',
    audience: 'Current Scholars',
    views: 0
  },
];

export default function AnnouncementsManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAudience, setNewAudience] = useState('all');
  const [scheduleDate, setScheduleDate] = useState('');

  const handleCreate = () => {
    // Handle create announcement logic
    setShowCreateForm(false);
    setNewTitle('');
    setNewContent('');
    setNewAudience('all');
    setScheduleDate('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return <Badge className="bg-green-100 text-green-800">Published</Badge>;
      case 'Draft':
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>;
      case 'Scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Announcements</h1>
          <p className="text-gray-600 mt-1">Create and manage announcements for students</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Announcement
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="shadow-md border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle>Create New Announcement</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Editor */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Announcement Title
                  </label>
                  <Input
                    placeholder="Enter announcement title..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Content
                  </label>
                  <Textarea
                    placeholder="Write your announcement content here..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={12}
                    className="resize-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline">
                      <strong>B</strong>
                    </Button>
                    <Button size="sm" variant="outline">
                      <em>I</em>
                    </Button>
                    <Button size="sm" variant="outline">
                      <u>U</u>
                    </Button>
                    <Button size="sm" variant="outline">
                      Link
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Target Audience
                  </label>
                  <Select value={newAudience} onValueChange={setNewAudience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      <SelectItem value="applicants">New Applicants</SelectItem>
                      <SelectItem value="scholars">Current Scholars</SelectItem>
                      <SelectItem value="tes">TES Recipients Only</SelectItem>
                      <SelectItem value="tdp">TDP Recipients Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Schedule Publish Date (Optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to publish immediately
                  </p>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Preview
                </label>
                <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50 min-h-[400px]">
                  <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {newTitle || 'Announcement Title'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date().toLocaleDateString()}</span>
                      <span>•</span>
                      <Users className="w-4 h-4" />
                      <span>
                        {newAudience === 'all' ? 'All Students' :
                         newAudience === 'applicants' ? 'New Applicants' :
                         newAudience === 'scholars' ? 'Current Scholars' :
                         newAudience === 'tes' ? 'TES Recipients' :
                         newAudience === 'tdp' ? 'TDP Recipients' : 'All Students'}
                      </span>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {newContent || 'Your announcement content will appear here...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button variant="outline">
                Save as Draft
              </Button>
              <Button 
                onClick={handleCreate}
                className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                POST ANNOUNCEMENT
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Announcements */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Existing Announcements</h2>
        
        {existingAnnouncements.map((announcement) => (
          <Card key={announcement.id} className="shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                {/* Left Section - Content */}
                <div className="flex-1">
                  <div className="flex items-start gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {announcement.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {announcement.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {announcement.status === 'Published' ? 'Published' : 
                         announcement.status === 'Scheduled' ? 'Scheduled for' : 'Draft'} 
                        {announcement.publishedDate && `: ${announcement.publishedDate}`}
                      </span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{announcement.audience}</span>
                    </div>
                    {announcement.status === 'Published' && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{announcement.views} views</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Section - Status & Actions */}
                <div className="flex flex-col items-end gap-3">
                  {getStatusBadge(announcement.status)}
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-1" />
                      EDIT
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      DELETE
                    </Button>
                    {announcement.status === 'Draft' && (
                      <Button 
                        size="sm" 
                        className="bg-[#10B981] hover:bg-[#10B981]/90 text-white"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        PUBLISH
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-[#1E3A8A]">8</p>
            <p className="text-sm text-gray-600 mt-1">Total Announcements</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-green-600">5</p>
            <p className="text-sm text-gray-600 mt-1">Published</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-gray-600">2</p>
            <p className="text-sm text-gray-600 mt-1">Drafts</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-blue-600">1,234</p>
            <p className="text-sm text-gray-600 mt-1">Total Views</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
