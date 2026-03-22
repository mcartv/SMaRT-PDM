import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import pdmLogo from '../../../assets/pdm-logo.png';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login - navigate to dashboard
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-[#1E3A8A] rounded-full flex items-center justify-center p-2">
              <img src={pdmLogo} alt="PDM Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Office for Scholarship and Financial Assistance</h1>
          <p className="text-gray-600">Scholarship Monitoring & Tracking System</p>
          <Badge className="mt-3 bg-[#1E3A8A] text-white">OSFA Staff Access Only</Badge>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Login</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* <div>
              <Label htmlFor="staffId" className="text-gray-700">Staff ID</Label>
              <Input
                id="staffId"
                type="text"
                placeholder="Enter your staff ID"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mt-1.5"
                required
              />
            </div> */}

            <div>
              <Label htmlFor="email" className="text-gray-700">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10" // Prevents text from overlapping the icon
                  required
                />
                <button
                  type="button" // Important: prevents form submission when clicking the icon
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2 rounded border-gray-300" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-[#1E3A8A] hover:underline">Forgot password?</a>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white h-11"
            >
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>© 2026 Office for Scholarship and Financial Assistance. All rights reserved.</p>
          <p className="mt-1">Office of Student Financial Assistance</p>
        </div>
      </div>
    </div>
  );
}
