import React, { useState, useEffect } from 'react';
import { MessageSquare, Globe, Key, Save, Timer, Wallet, Settings } from 'lucide-react';

export default function Configuration() {
    const [form, setForm] = useState({
        system_prompt: '',
        short_delay_seconds: 5,
        long_delay_seconds: 30,
        advance_amount: 0,
        agent_enabled: true
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/agent-config')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setForm({
                        system_prompt: data.data.system_prompt || '',
                        short_delay_seconds: data.data.short_delay_seconds ?? 5,
                        long_delay_seconds: data.data.long_delay_seconds ?? 30,
                        advance_amount: data.data.advance_amount ?? 0,
                        agent_enabled: data.data.agent_enabled === 1 || data.data.agent_enabled === true
                    });
                }
            })
            .catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/agent-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                alert('Configuration saved successfully!');
            } else {
                alert('Failed to save configuration.');
            }
        } catch (e) {
            alert('Error connecting to backend.');
        }
        setSaving(false);
    };

    const webhookUrl = "https://your-hostinger-domain.com/api/lovable-webhook";

    return (
        <div className="mx-auto max-w-2xl text-slate-100">
            <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
            <p className="mt-1 text-sm text-slate-400">
                WhatsApp connection, system prompt, reply delays and advance payment amount.
            </p>

            <section className="mt-6 rounded-2xl bg-[#09181E] border border-teal-900/40 p-5 shadow-lg">
                <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-teal-400" />
                    <h2 className="font-medium">WhatsApp Business Connection</h2>
                    <span className="ml-auto bg-teal-900/30 text-teal-400 border border-teal-700/50 px-2 py-1 rounded text-xs flex items-center">
                        <Globe className="mr-1 h-3 w-3" /> Pawanda Shoes
                    </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                    Your "Pawanda Shoes" WhatsApp connection uses the Lovable Bridge. Forward incoming webhook payloads to:
                </p>

                <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Key className="h-3 w-3" /> Webhook URL
                        </label>
                        <div className="flex gap-2">
                            <input readOnly value={webhookUrl} className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono outline-none" />
                            <button
                                onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('Copied!'); }}
                                className="bg-teal-950 hover:bg-teal-900 border border-teal-800/40 text-teal-300 px-3 py-2 rounded-xl text-xs transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-6 rounded-2xl bg-[#09181E] border border-teal-900/40 p-5 shadow-lg">
                <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-teal-400" />
                    <h2 className="font-medium">AI Agent Configuration</h2>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-slate-400">Enable Agent</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={form.agent_enabled} onChange={e => setForm({...form, agent_enabled: e.target.checked})} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                        </label>
                    </div>
                </div>
                
                <div className="mt-5 space-y-5">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">System Prompt</label>
                        <p className="text-[10px] text-slate-500 mb-2">Instructions defining how the AI agent communicates with customers.</p>
                        <textarea
                            value={form.system_prompt}
                            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                            rows={8}
                            className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 outline-none resize-none custom-scrollbar"
                            placeholder="You are a helpful assistant for Pawanda Shoes..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                <Timer className="h-3.5 w-3.5 text-teal-500" /> Short Delay (seconds)
                            </label>
                            <input
                                type="number"
                                value={form.short_delay_seconds}
                                onChange={(e) => setForm({ ...form, short_delay_seconds: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                                <Timer className="h-3.5 w-3.5 text-teal-500" /> Long Delay (seconds)
                            </label>
                            <input
                                type="number"
                                value={form.long_delay_seconds}
                                onChange={(e) => setForm({ ...form, long_delay_seconds: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                            <Wallet className="h-3.5 w-3.5 text-teal-500" /> Advance Amount (Rs)
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">Required advance payment amount for orders.</p>
                        <input
                            type="number"
                            value={form.advance_amount}
                            onChange={(e) => setForm({ ...form, advance_amount: parseInt(e.target.value) || 0 })}
                            className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                    </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg transition-all"
                    >
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </section>
        </div>
    );
}
