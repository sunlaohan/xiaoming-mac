import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Bot } from 'lucide-react';
import botAvatar from '@/assets/logo2.png';

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* AI Avatar */}
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={botAvatar} alt="AI" />
        <AvatarFallback className="bg-gray-500">
          <Bot className="h-4 w-4 text-white" />
        </AvatarFallback>
      </Avatar>

      {/* Typing bubble */}
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div className="bg-gray-100 rounded-lg px-4 py-3 inline-block">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1.5" aria-label="AI正在思考">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="ml-2 text-sm text-gray-500 animate-pulse">思考中</span>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-1.5 ml-1">
          小鸣同学
        </div>
      </div>
    </div>
  );
}
