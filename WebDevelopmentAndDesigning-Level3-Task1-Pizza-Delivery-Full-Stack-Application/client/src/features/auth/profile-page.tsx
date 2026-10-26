import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User as UserIcon, Mail, Phone, Calendar, LogOut, ShieldCheck, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';
import { authService } from '@/services/auth.service';
import { formatDate } from '@/lib/format';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      updateUser({ name, phone });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="ambient-gradient">
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your Profile</h1>

      <div className="space-y-6">
        {/* Account info */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 text-xl font-bold text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-display text-lg font-semibold">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                  {user.isEmailVerified ? (
                    <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                  ) : (
                    <Badge variant="outline">Unverified</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Add your phone number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="shadow-lg shadow-primary/20">
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Account meta */}
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">{formatDate(user.createdAt)}</span>
            </div>
            <Separator />
            <Button variant="outline" asChild className="w-full">
              <a href="/orders"><Package className="mr-2 h-4 w-4" /> View My Orders</a>
            </Button>
            <Separator />
            <Button variant="destructive" onClick={handleLogout} className="w-full shadow-lg shadow-destructive/20">
              <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
