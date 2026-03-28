import { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../stores/chatStore';
import { useAccessibilityStore } from '../../stores/accessibilityStore';
import { announceToScreenReader } from '../../lib/accessibility';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { HomeCommands } from '../home';
import { EntitySuggestion } from './EntitySuggestion';
import { useDemoMask } from '../../hooks';

interface MessageListProps {
  onPromptSelect?: (prompt: string, skillId?: string) => void;
  onSaveAsCommand?: (userPrompt: string, assistantContent: string) => void;
  onGuidedPanelChange?: (active: boolean) => void;
}

export function MessageList({ onPromptSelect, onSaveAsCommand, onGuidedPanelChange }: MessageListProps) {
  // Subscribe to actual state to trigger re-renders when messages change
  const conversations = useChatStore((state) => state.conversations);
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const clearMessageEntities = useChatStore((state) => state.clearMessageEntities);
  const { enabled: demoEnabled, maskText } = useDemoMask();
  const reduceMotion = useAccessibilityStore((s) => s.reduceMotion);
  const announceMessages = useAccessibilityStore((s) => s.announceMessages);
  const prevMsgCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Compute current conversation from subscribed state
  const conversation = conversations.find((c) => c.id === currentConversationId) || null;

  const handleEntityDismiss = useCallback((messageId: string) => {
    clearMessageEntities(messageId);
  }, [clearMessageEntities]);

  const handleEntitySaved = useCallback(() => {
    console.log('Entity saved to memory');
  }, []);

  // US-012 : Annoncer les nouveaux messages assistant au lecteur d'écran
  useEffect(() => {
    if (!conversation || !announceMessages) return;
    const msgCount = conversation.messages.length;
    if (msgCount > prevMsgCountRef.current && msgCount > 0) {
      const lastMsg = conversation.messages[msgCount - 1];
      if (lastMsg.role === 'assistant' && !lastMsg.isStreaming) {
        announceToScreenReader('Nouveau message de Therese');
      }
    }
    prevMsgCountRef.current = msgCount;
  }, [conversation?.messages, announceMessages]);

  // Mode démo : masquer le contenu des messages avant rendu
  const displayMessages = useMemo(() => {
    if (!conversation) return [];
    if (!demoEnabled) return conversation.messages;
    return conversation.messages.map((msg) => ({
      ...msg,
      content: maskText(msg.content),
    }));
  }, [demoEnabled, conversation, maskText]);

  // Auto-scroll vers le bas quand un nouveau message arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
    }
  }, [displayMessages.length, displayMessages[displayMessages.length - 1]?.content, isStreaming]);

  // Empty state with guided prompts UI
  if (!conversation || conversation.messages.length === 0) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center py-8">
        <HomeCommands onPromptSelect={onPromptSelect || (() => {})} onGuidedPanelChange={onGuidedPanelChange} />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto"
      aria-live="polite"
      aria-label="Messages de la conversation"
      data-testid="chat-message-list"
    >
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col">
        {displayMessages.map((message, index) => (
          <div
            key={message.id || index}
            className="py-2"
            data-testid="chat-message-item"
          >
            <MessageBubble
              message={message}
              onSaveAsCommand={
                message.role === 'assistant' && !message.isStreaming && onSaveAsCommand
                  ? () => {
                      let userPrompt = '';
                      for (let i = index - 1; i >= 0; i--) {
                        if (displayMessages[i].role === 'user') {
                          userPrompt = displayMessages[i].content;
                          break;
                        }
                      }
                      onSaveAsCommand(userPrompt, message.content);
                    }
                  : undefined
              }
            />

            {/* Show entity suggestions after assistant messages */}
            {message.role === 'assistant' && message.detectedEntities && (
              (message.detectedEntities.contacts.length > 0 ||
                message.detectedEntities.projects.length > 0) && (
                <EntitySuggestion
                  contacts={message.detectedEntities.contacts}
                  projects={message.detectedEntities.projects}
                  messageId={message.id}
                  onDismiss={() => handleEntityDismiss(message.id)}
                  onSaved={handleEntitySaved}
                />
              )
            )}
          </div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
