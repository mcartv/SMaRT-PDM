import { useState } from 'react';
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
    User, Mail, Phone, MapPin, Lock, Eye, EyeOff,
    Save, Check, Camera, Shield, Clock, Activity,
    LogOut, Key,
} from 'lucide-react';

const C = {
    brown: '#5c2d0e',
    amberSoft: '#FFF7ED',
    yellowSoft: '#fef3c7',
    sand: '#fdf6ec',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
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

function FieldLabel({ children }) {
    return (
        <label className="text-[11px] font-semibold block mb-1.5">
            {children}
        </label>
    );
}

function SectionCard({ title, icon: Icon, children }) {
    return (
        <div style={CARD}>
            <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: BD }}>
                <Icon className="w-4 h-4" />
                <p className="text-xs font-bold">{title}</p>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

export default function AdminProfile() {
    const [firstName, setFirstName] = useState('Carmelita');

    return (
        <div className="space-y-5 py-1">
            <h1 className="text-2xl font-bold">My Profile</h1>
            <SectionCard title="Personal Information" icon={User}>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </SectionCard>
        </div>
    );
}