import { useState } from 'react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, Send } from 'lucide-react';

const C = {
  brown: '#5c2d0e',
  border: '#e8d5b7',
  muted: '#a0785a',
  text: '#3b1f0a',
  white: '#FFFFFF',
};

const BD = '1px solid ' + C.border;

const CARD = {
  background: C.white,
  border: BD,
  borderRadius: 16,
};

export default function AnnouncementsManagement() {
  const [title, setTitle] = useState('');

  return (
    <div className="space-y-5 py-1">
      <h1 className="text-2xl font-bold">Announcements</h1>

      <div style={CARD} className="p-5">
        <Input value={title} onChange={e => setTitle(e.target.value)} />
      </div>
    </div>
  );
}