'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Bot, Sparkles } from "lucide-react"
import { useState } from 'react';

export default function AgentPage() {
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
        }),
    });
    const [input, setInput] = useState('');

    return (
        <div className="flex-1 bg-background min-h-screen flex flex-col">
            {/* Modern Header */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background shrink-0">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Sparkles className="w-4 h-4" />
                            <span>AI Assistant</span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            CS12 Agent
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your customer success AI assistant
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Container */}
            <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 lg:px-8">
                {/* Messages Area */}
                <ScrollArea className="flex-1 py-6">
                    <div className="flex flex-col gap-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center text-center py-16">
                                <div className="p-4 rounded-2xl bg-primary/10 mb-4">
                                    <Bot className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-1">How can I help you today?</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Ask me anything about your clients, doctors, or customer success metrics.
                                </p>
                            </div>
                        )}
                        {messages.map(message => (
                            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role !== 'user' && (
                                    <Avatar className="w-8 h-8 border border-border/50 shrink-0">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                                        <AvatarImage src="/bot-avatar.png" />
                                    </Avatar>
                                )}
                                <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${message.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-md'
                                        : 'bg-muted/50 text-foreground border border-border/50 rounded-bl-md'
                                    }`}>
                                    {message.parts.map((part, index) =>
                                        part.type === 'text' ? <span key={index} className="text-sm">{part.text}</span> : null
                                    )}
                                </div>
                                {message.role === 'user' && (
                                    <Avatar className="w-8 h-8 border border-border/50 shrink-0">
                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">You</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                        {status === 'streaming' && (
                            <div className="flex gap-3 justify-start">
                                <Avatar className="w-8 h-8 border border-border/50">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs">AI</AvatarFallback>
                                </Avatar>
                                <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="py-4 border-t border-border/50 shrink-0">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (input.trim()) {
                                sendMessage({ text: input });
                                setInput('');
                            }
                        }}
                        className="flex gap-2"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 bg-muted/30 border-border/50 focus-visible:ring-primary"
                            disabled={status !== 'ready'}
                        />
                        <Button
                            type="submit"
                            disabled={status !== 'ready' || !input.trim()}
                            className="shadow-sm"
                        >
                            <Send className="w-4 h-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
