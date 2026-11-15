'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Phone,
  Check,
  CheckCheck,
  Lock,
  MessageSquare,
  ShieldCheck,
  Wifi,
  WifiOff,
  Sparkles,
  Clock,
  Radio
} from 'lucide-react';
import { OrderMessage } from '@/hooks/useOrderCommunication';

interface OrderChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  orderStatus: string;
  userRole: 'customer' | 'rider';
  counterpartName: string;
  messages: OrderMessage[];
  counterpartTyping: boolean;
  isClosed: boolean;
  channelConnected?: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  onSendTyping: () => void;
  onStartCall: () => void;
  onMarkRead: () => void;
}

const QUICK_REPLIES_CUSTOMER = [
  'I am outside the gate waiting.',
  'Please ring the doorbell when you arrive.',
  'Please call me once you are nearby.',
  'Take your time and ride safely!'
];

const QUICK_REPLIES_RIDER = [
  'I have picked up your food and I am on the way!',
  'I have arrived at your delivery address.',
  'Please check the gate or lobby entrance.',
  'Heavy traffic here, will arrive shortly.'
];

export function OrderChatModal({
  isOpen,
  onClose,
  orderCode,
  orderStatus,
  userRole,
  counterpartName,
  messages,
  counterpartTyping,
  isClosed,
  channelConnected = true,
  onSendMessage,
  onSendTyping,
  onStartCall,
  onMarkRead
}: OrderChatModalProps) {
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      onMarkRead();
    }
  }, [isOpen, messages, counterpartTyping, onMarkRead]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || submitting || isClosed) return;

    setSubmitting(true);
    setInputText('');
    await onSendMessage(text);
    setSubmitting(false);
  };

  const quickReplies = userRole === 'customer' ? QUICK_REPLIES_CUSTOMER : QUICK_REPLIES_RIDER;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-fade-in">
      {/* Luxury Modal Container */}
      <div className="bg-white text-zinc-900 w-full sm:max-w-lg h-[92vh] sm:h-[650px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200">
        
        {/* Luxury Header — Obsidian #17140D with Gold Accents */}
        <div className="bg-[#17140D] text-white px-5 py-4 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-brand-gold text-zinc-950 flex items-center justify-center font-black text-sm shadow-sm">
                {counterpartName.charAt(0).toUpperCase()}
              </div>
              <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#17140D] rounded-full ${channelConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base leading-tight text-white">
                  {counterpartName}
                </h3>
                <span className="text-[10px] font-bold bg-white/10 text-brand-gold px-2 py-0.5 rounded-full">
                  {userRole === 'customer' ? 'Dedicated Courier' : 'Customer'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span>Order #{orderCode}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {channelConnected ? (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live
                    </span>
                  ) : (
                    <span className="text-amber-400 text-[10px] flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Connecting
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isClosed && (
              <button
                type="button"
                onClick={onStartCall}
                title="Start in-app voice call"
                className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition active:scale-90 shadow-sm"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security & Masking Advisory Banner — Cream #FFFBEF */}
        <div className="bg-[#FFFBEF] border-b border-amber-200/80 px-4 py-2 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-amber-900 min-w-0">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[11px] font-semibold truncate">
              Private In-App Channel • Masked Numbers
            </span>
          </div>
          <span className="text-[10px] uppercase font-black text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full shrink-0">
            Encrypted
          </span>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/70">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-brand-gold">
                <MessageSquare className="w-6 h-6 text-amber-600" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-800">Direct Delivery Chat</p>
                <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                  Coordinate delivery details with your {userRole === 'customer' ? 'rider' : 'customer'} directly without exchanging phone numbers.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_role === userRole;
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium shadow-xs transition-all ${
                      isMe
                        ? 'bg-[#17140D] text-white rounded-br-xs'
                        : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMe ? 'text-zinc-400' : 'text-zinc-400'
                      }`}
                    >
                      <span>{formattedTime}</span>
                      {isMe && (
                        <span>
                          {msg.delivery_status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-brand-gold" />
                          ) : msg.delivery_status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {counterpartTyping && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 italic pl-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-brand-gold"></span>
              <span>{counterpartName} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies Tray */}
        {!isClosed && (
          <div className="px-4 py-2 bg-white border-t border-zinc-100 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(reply)}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-[#FFFBEF] hover:border-amber-300 border border-zinc-200 text-[11px] font-semibold text-zinc-700 transition shrink-0 active:scale-95"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-zinc-200 shrink-0">
          {isClosed ? (
            <div className="bg-zinc-100 rounded-2xl p-3 text-center text-xs text-zinc-500 font-medium flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-zinc-400" />
              <span>This order delivery is concluded. Chat is archived.</span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  onSendTyping();
                }}
                placeholder={`Message ${counterpartName}...`}
                maxLength={1000}
                className="flex-1 bg-zinc-100 hover:bg-zinc-100/80 focus:bg-white text-zinc-900 placeholder-zinc-400 text-xs sm:text-sm px-4 py-3 rounded-2xl border border-transparent focus:border-brand-gold focus:outline-none transition shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || submitting}
                className="w-11 h-11 rounded-2xl bg-[#17140D] hover:bg-zinc-800 disabled:opacity-40 text-brand-gold flex items-center justify-center transition active:scale-95 shrink-0 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
