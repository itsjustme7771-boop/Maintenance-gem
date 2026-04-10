/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Wrench, 
  BookOpen, 
  Bot, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Mic, 
  MicOff, 
  Volume2, 
  AlertTriangle,
  ChevronRight,
  History,
  User as UserIcon,
  ShieldCheck,
  Menu,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, googleProvider, testConnection, handleFirestoreError, OperationType } from './lib/firebase';
import { UserProfile, Equipment, MaintenanceLog, KnowledgeEntry, UserRole } from './types';
import { getTroubleshootingAdvice } from './services/geminiService';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        setHasError(true);
        setErrorInfo(event.error.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    const info = JSON.parse(errorInfo || '{}');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied or System Error</h1>
        <p className="text-zinc-400 max-w-md mb-6">
          {info.error || "An unexpected error occurred. Please check your permissions or contact an admin."}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload Application
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create profile
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Technician',
            role: 'technician', // Default role
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qEquip = query(collection(db, 'equipment'), orderBy('name'));
    const unsubEquip = onSnapshot(qEquip, (snapshot) => {
      setEquipment(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'equipment'));

    const qKnow = query(collection(db, 'knowledge'), orderBy('createdAt', 'desc'), limit(20));
    const unsubKnow = onSnapshot(qKnow, (snapshot) => {
      setKnowledge(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KnowledgeEntry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'knowledge'));

    return () => {
      unsubEquip();
      unsubKnow();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      toast.error("Login failed. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex justify-center">
            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <Wrench className="w-12 h-12 text-amber-500" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-100 italic">HUB <span className="text-amber-500">MAINTENANCE</span></h1>
            <p className="mt-2 text-zinc-400">Industrial Troubleshooting & Knowledge Retention</p>
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Technician Login</CardTitle>
              <CardDescription className="text-zinc-400">Access the plant maintenance system</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleLogin} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-6 rounded-xl transition-all shadow-lg shadow-amber-900/20">
                Sign in with Google
              </Button>
            </CardContent>
            <CardFooter className="justify-center">
              <p className="text-xs text-zinc-500">Authorized Personnel Only</p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
        <Toaster position="top-right" theme="dark" />
        
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 280 : 80 }}
          className="bg-zinc-900 border-r border-zinc-800 flex flex-col z-50 relative"
        >
          <div className="p-6 flex items-center justify-between">
            {isSidebarOpen && (
              <h2 className="text-xl font-bold tracking-tighter italic">HUB <span className="text-amber-500">MAINT</span></h2>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-zinc-400 hover:text-white">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>

          <nav className="flex-1 px-3 space-y-2 mt-4">
            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
            <NavItem icon={<Wrench size={20} />} label="Equipment" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} collapsed={!isSidebarOpen} />
            <NavItem icon={<BookOpen size={20} />} label="Knowledge Base" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} collapsed={!isSidebarOpen} />
            <NavItem icon={<Bot size={20} />} label="AI Assistant" active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} collapsed={!isSidebarOpen} />
            {(profile?.role === 'admin' || profile?.role === 'lead') && (
              <NavItem icon={<Settings size={20} />} label="Admin Panel" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} collapsed={!isSidebarOpen} />
            )}
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <div className={`flex items-center gap-3 ${isSidebarOpen ? 'px-2' : 'justify-center'}`}>
              <Avatar className="w-8 h-8 border border-zinc-700">
                <AvatarImage src={user.photoURL || ''} />
                <AvatarFallback className="bg-zinc-800 text-xs">{user.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-[10px] text-amber-500 uppercase font-bold tracking-wider">{profile?.role}</p>
                </div>
              )}
              {isSidebarOpen && (
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-500 hover:text-red-400">
                  <LogOut size={18} />
                </Button>
              )}
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-8 z-40">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h1>
              <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 font-mono text-[10px]">
                PLANT_01 // SECTOR_B
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <Input placeholder="Search equipment or logs..." className="pl-10 w-64 bg-zinc-900 border-zinc-800 focus:border-amber-500/50" />
              </div>
              <Button variant="outline" size="sm" className="border-zinc-800 hover:bg-zinc-900">
                <History size={16} className="mr-2" />
                Recent Activity
              </Button>
            </div>
          </header>

          <ScrollArea className="flex-1 p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <DashboardView key="dashboard" equipment={equipment} knowledge={knowledge} profile={profile} />}
              {activeTab === 'equipment' && <EquipmentView key="equipment" equipment={equipment} profile={profile} />}
              {activeTab === 'knowledge' && <KnowledgeView key="knowledge" knowledge={knowledge} equipment={equipment} profile={profile} />}
              {activeTab === 'ai' && <AIView key="ai" equipment={equipment} />}
              {activeTab === 'admin' && <AdminView key="admin" profile={profile} />}
            </AnimatePresence>
          </ScrollArea>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

function DashboardView({ equipment, knowledge, profile }: { equipment: Equipment[], knowledge: KnowledgeEntry[], profile: UserProfile | null }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Equipment" value={equipment.length.toString()} icon={<Wrench className="text-amber-500" />} trend="+2 this month" />
        <StatCard title="Knowledge Entries" value={knowledge.length.toString()} icon={<BookOpen className="text-blue-500" />} trend="Shared wisdom" />
        <StatCard title="Pending Tasks" value="12" icon={<AlertTriangle className="text-red-500" />} trend="4 high priority" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertItem title="Conveyor Belt B-12" status="Vibration Warning" time="2h ago" />
            <AlertItem title="Mixer M-04" status="Overheat Detected" time="5h ago" />
            <AlertItem title="Packer P-01" status="Scheduled PM Overdue" time="1d ago" />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen size={20} className="text-blue-500" />
              Recent Knowledge Shared
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledge.slice(0, 4).map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-sm">{entry.title}</p>
                  <p className="text-xs text-zinc-500">By {entry.authorName} • {new Date(entry.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

function EquipmentView({ equipment, profile }: { equipment: Equipment[], profile: UserProfile | null }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEquip, setNewEquip] = useState({ name: '', model: '', serialNumber: '', location: '', description: '' });

  const handleAdd = async () => {
    if (!newEquip.name || !newEquip.location) {
      toast.error("Name and Location are required");
      return;
    }
    try {
      await addDoc(collection(db, 'equipment'), {
        ...newEquip,
        createdAt: serverTimestamp()
      });
      setIsAddOpen(false);
      setNewEquip({ name: '', model: '', serialNumber: '', location: '', description: '' });
      toast.success("Equipment added successfully");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'equipment');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Plant Inventory</h2>
        {(profile?.role === 'admin' || profile?.role === 'lead') && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger>
              <Button className="bg-amber-600 hover:bg-amber-700">
                <Plus size={18} className="mr-2" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <DialogHeader>
                <DialogTitle>Add New Machine</DialogTitle>
                <DialogDescription className="text-zinc-400">Register a new piece of equipment in the system.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Machine Name</Label>
                  <Input id="name" value={newEquip.name} onChange={e => setNewEquip({...newEquip, name: e.target.value})} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Main Conveyor B1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" value={newEquip.model} onChange={e => setNewEquip({...newEquip, model: e.target.value})} className="bg-zinc-950 border-zinc-800" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="serial">Serial Number</Label>
                    <Input id="serial" value={newEquip.serialNumber} onChange={e => setNewEquip({...newEquip, serialNumber: e.target.value})} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location / Line</Label>
                  <Input id="location" value={newEquip.location} onChange={e => setNewEquip({...newEquip, location: e.target.value})} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Line 4, North Wall" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" value={newEquip.description} onChange={e => setNewEquip({...newEquip, description: e.target.value})} className="bg-zinc-950 border-zinc-800" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-zinc-800">Cancel</Button>
                <Button onClick={handleAdd} className="bg-amber-600 hover:bg-amber-700">Save Equipment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {equipment.map(item => (
          <EquipmentCard key={item.id} item={item} />
        ))}
      </div>
    </motion.div>
  );
}

function KnowledgeView({ knowledge, equipment, profile }: { knowledge: KnowledgeEntry[], equipment: Equipment[], profile: UserProfile | null }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', equipmentId: '', tags: '' });

  const handleAdd = async () => {
    if (!newEntry.title || !newEntry.content || !newEntry.equipmentId) {
      toast.error("All fields are required");
      return;
    }
    try {
      await addDoc(collection(db, 'knowledge'), {
        ...newEntry,
        tags: newEntry.tags.split(',').map(t => t.trim()),
        authorId: auth.currentUser?.uid,
        authorName: auth.currentUser?.displayName || 'Technician',
        createdAt: serverTimestamp()
      });
      setIsAddOpen(false);
      setNewEntry({ title: '', content: '', equipmentId: '', tags: '' });
      toast.success("Knowledge shared! Thanks for helping the team.");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'knowledge');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Technician Wisdom</h2>
          <p className="text-zinc-400 text-sm">Shared troubleshooting tips and machine quirks.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus size={18} className="mr-2" />
              Share Wisdom
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
            <DialogHeader>
              <DialogTitle>Share Troubleshooting Tip</DialogTitle>
              <DialogDescription className="text-zinc-400">Help future techs by documenting a fix or a machine quirk.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Related Equipment</Label>
                <Select onValueChange={(v: string) => setNewEntry({...newEntry, equipmentId: v})}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {equipment.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Title / Symptom</Label>
                <Input value={newEntry.title} onChange={e => setNewEntry({...newEntry, title: e.target.value})} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Belt Slippage on Startup" />
              </div>
              <div className="grid gap-2">
                <Label>The Fix / Wisdom</Label>
                <Textarea value={newEntry.content} onChange={e => setNewEntry({...newEntry, content: e.target.value})} className="bg-zinc-950 border-zinc-800 min-h-[200px]" placeholder="Describe the problem and how you solved it..." />
              </div>
              <div className="grid gap-2">
                <Label>Tags (comma separated)</Label>
                <Input value={newEntry.tags} onChange={e => setNewEntry({...newEntry, tags: e.target.value})} className="bg-zinc-950 border-zinc-800" placeholder="mechanical, electrical, quick-fix" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-zinc-800">Cancel</Button>
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">Post Entry</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {knowledge.map(entry => (
          <Card key={entry.id} className="bg-zinc-900 border-zinc-800 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{entry.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                      {equipment.find(e => e.id === entry.equipmentId)?.name || 'General'}
                    </Badge>
                    <span>By {entry.authorName}</span>
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  {entry.tags?.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] uppercase border-zinc-700">{tag}</Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap line-clamp-3">{entry.content}</p>
            </CardContent>
            <CardFooter className="bg-zinc-950/50 py-3 flex justify-between">
              <span className="text-xs text-zinc-500">{new Date(entry.createdAt?.seconds * 1000).toLocaleString()}</span>
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">Read Full Entry</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function AIView({ equipment }: { equipment: Equipment[] }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [selectedEquip, setSelectedEquip] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Speech Recognition Setup
  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    const equipInfo = equipment.find(e => e.id === selectedEquip)?.name || "General Machinery";
    const history = messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', text: m.text }));
    
    const advice = await getTroubleshootingAdvice(equipInfo, userMsg, history);
    
    setMessages(prev => [...prev, { role: 'ai', text: advice }]);
    setIsThinking(false);

    // Text to Speech
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(advice.replace(/[#*]/g, ''));
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="h-full flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="text-amber-500" />
            Maintenance Assistant
          </h2>
          <p className="text-zinc-400 text-sm">AI-powered troubleshooting and safety guidance.</p>
        </div>
        <div className="w-64">
          <Select onValueChange={setSelectedEquip}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800">
              <SelectValue placeholder="Target Machine" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              {equipment.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="flex-1 bg-zinc-900 border-zinc-800 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 bg-zinc-800 rounded-full">
                  <Bot size={48} className="text-zinc-600" />
                </div>
                <div className="max-w-xs">
                  <p className="text-zinc-400">"Hey, I'm your digital lead tech. Tell me what's going on with the machine."</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700'}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-none border border-zinc-700">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleListening}
              className={`rounded-full ${isListening ? 'bg-red-500/20 text-red-500 border-red-500' : 'border-zinc-700'}`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </Button>
            <Input 
              placeholder="Describe the issue..." 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-zinc-900 border-zinc-800"
            />
            <Button onClick={handleSend} className="bg-amber-600 hover:bg-amber-700">
              Send
            </Button>
          </div>
          <div className="mt-2 flex justify-center">
             <p className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-widest">
               <Volume2 size={10} /> Voice Guidance Enabled
             </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function AdminView({ profile }: { profile: UserProfile | null }) {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('role'));
    return onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(d => d.data() as UserProfile));
    });
  }, []);

  const updateRole = async (uid: string, newRole: UserRole) => {
    try {
      await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
      toast.success("User role updated");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold">Team Management</h2>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">User</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Email</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Current Role</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.name}</span>
                    </td>
                    <td className="p-4 text-zinc-400 text-sm">{u.email}</td>
                    <td className="p-4">
                      <Badge className={
                        u.role === 'admin' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        u.role === 'lead' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        'bg-zinc-800 text-zinc-400'
                      }>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Select defaultValue={u.role} onValueChange={(v) => updateRole(u.uid, v as UserRole)}>
                        <SelectTrigger className="w-32 bg-zinc-950 border-zinc-800 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- UI Helpers ---

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl transition-all
        ${active ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
        ${collapsed ? 'justify-center' : ''}
      `}
    >
      {icon}
      {!collapsed && <span className="font-medium text-sm">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 64 })}
      </div>
      <CardHeader className="pb-2">
        <CardDescription className="text-zinc-500 text-xs uppercase tracking-widest font-bold">{title}</CardDescription>
        <CardTitle className="text-3xl font-bold tracking-tighter">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500">{trend}</p>
      </CardContent>
    </Card>
  );
}

function AlertItem({ title, status, time }: { title: string, status: string, time: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-red-500/80">{status}</p>
        </div>
      </div>
      <span className="text-[10px] text-zinc-600 font-mono">{time}</span>
    </div>
  );
}

function EquipmentCard({ item }: { item: Equipment }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all group overflow-hidden">
      <div className="h-2 bg-amber-600/20 group-hover:bg-amber-600/40 transition-colors" />
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{item.name}</CardTitle>
            <CardDescription className="text-zinc-500 font-mono text-[10px] uppercase mt-1">{item.location}</CardDescription>
          </div>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {item.model || 'N/A'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-zinc-950 rounded border border-zinc-800">
            <p className="text-zinc-500 uppercase text-[8px] font-bold">Serial</p>
            <p className="font-mono">{item.serialNumber || '---'}</p>
          </div>
          <div className="p-2 bg-zinc-950 rounded border border-zinc-800">
            <p className="text-zinc-500 uppercase text-[8px] font-bold">Status</p>
            <p className="text-green-500 font-bold">OPERATIONAL</p>
          </div>
        </div>
        <p className="text-zinc-400 text-xs line-clamp-2">{item.description}</p>
      </CardContent>
      <CardFooter className="bg-zinc-950/50 py-3 flex justify-between">
        <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white">
          <History size={14} className="mr-2" />
          Logs
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-amber-500 hover:text-amber-400">
          <FileText size={14} className="mr-2" />
          Manual
        </Button>
      </CardFooter>
    </Card>
  );
}
