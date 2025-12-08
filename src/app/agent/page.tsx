'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Bot } from "lucide-react"
import { useState } from 'react';

export default function AgentPage() {
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
        }),
    });
    const [input, setInput] = useState('');

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-2xl h-[80vh] flex flex-col shadow-xl border-0 ring-1 ring-gray-200">
                <CardHeader className="border-b bg-white rounded-t-xl">
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-800">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Bot className="w-6 h-6 text-blue-600" />
                        </div>
                        CS12 Agent
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 bg-white">
                    <ScrollArea className="h-full p-4">
                        <div className="flex flex-col gap-4">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 mt-20">
                                    <Bot className="w-12 h-12 mb-4 opacity-20" />
                                    <p>How can I help you today?</p>
                                </div>
                            )}
                            {messages.map(message => (
                                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {message.role !== 'user' && (
                                        <Avatar className="w-8 h-8 border">
                                            <AvatarFallback className="bg-blue-100 text-blue-600">AI</AvatarFallback>
                                            <AvatarImage src="/bot-avatar.png" />
                                        </Avatar>
                                    )}
                                    <div className={`rounded-2xl px-4 py-2 max-w-[80%] ${message.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                        }`}>
                                        {message.parts.map((part, index) =>
                                            part.type === 'text' ? <span key={index}>{part.text}</span> : null
                                        )}
                                    </div>
                                    {message.role === 'user' && (
                                        <Avatar className="w-8 h-8 border">
                                            <AvatarFallback className="bg-gray-100 text-gray-600">You</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                            {status === 'streaming' && (
                                <div className="flex gap-3 justify-start">
                                    <Avatar className="w-8 h-8 border">
                                        <AvatarFallback className="bg-blue-100 text-blue-600">AI</AvatarFallback>
                                    </Avatar>
                                    <div className="bg-gray-100 rounded-2xl px-4 py-2 rounded-bl-none flex items-center gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="p-4 border-t bg-white rounded-b-xl">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (input.trim()) {
                                sendMessage({ text: input });
                                setInput('');
                            }
                        }}
                        className="flex w-full gap-2"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 border-gray-200 focus-visible:ring-blue-500"
                            disabled={status !== 'ready'}
                        />
                        <Button type="submit" disabled={status !== 'ready' || !input.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Send className="w-4 h-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}
