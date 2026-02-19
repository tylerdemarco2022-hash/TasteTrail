import React, { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'

const STORAGE_KEY = 'taste-trails-messages'
const CURRENT_USER = 'You'

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch (e) {}
}

export default function Messages({ onClose }) {
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatUser, setNewChatUser] = useState('')

  // Mock users from groups
  const availableUsers = ['Maya', 'Liam', 'Ava', 'Alex', 'Jordan', 'Sam']

  useEffect(() => {
    const allMessages = loadMessages()
    setMessages(allMessages)
    
    // Group messages by conversation
    const convos = {}
    allMessages.forEach(msg => {
      const otherUser = msg.from === CURRENT_USER ? msg.to : msg.from
      if (!convos[otherUser]) {
        convos[otherUser] = []
      }
      convos[otherUser].push(msg)
    })
    
    setConversations(Object.entries(convos).map(([user, msgs]) => ({
      user,
      messages: msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      lastMessage: msgs[msgs.length - 1]
    })))
  }, [])

  function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return
    
    const msg = {
      id: Date.now(),
      from: CURRENT_USER,
      to: selectedConversation,
      text: newMessage,
      timestamp: new Date().toISOString()
    }
    
    const updated = [...messages, msg]
    setMessages(updated)
    saveMessages(updated)
    
    // Update conversations
    const convos = { ...conversations }
    const convo = conversations.find(c => c.user === selectedConversation)
    if (convo) {
      convo.messages.push(msg)
      convo.lastMessage = msg
    } else {
      setConversations([...conversations, {
        user: selectedConversation,
        messages: [msg],
        lastMessage: msg
      }])
    }
    
    setNewMessage('')
  }

  function startNewChat() {
    if (!newChatUser) return
    setSelectedConversation(newChatUser)
    setShowNewChat(false)
    setNewChatUser('')
  }

  const currentConvo = conversations.find(c => c.user === selectedConversation)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Messages</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Conversations List */}
          <div className="w-1/3 border-r overflow-y-auto">
            <div className="p-2">
              <button 
                onClick={() => setShowNewChat(true)}
                className="w-full px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                New Chat
              </button>
            </div>
            <div className="divide-y">
              {conversations.map((convo) => (
                <button
                  key={convo.user}
                  onClick={() => setSelectedConversation(convo.user)}
                  className={`w-full p-3 text-left hover:bg-gray-50 ${
                    selectedConversation === convo.user ? 'bg-yellow-50' : ''
                  }`}
                >
                  <div className="font-semibold">{convo.user}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {convo.lastMessage.text}
                  </div>
                </button>
              ))}
              {conversations.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No messages yet. Start a new chat!
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b bg-gray-50">
                  <div className="font-semibold">{selectedConversation}</div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {currentConvo?.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from === CURRENT_USER ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          msg.from === CURRENT_USER
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        <div>{msg.text}</div>
                        <div className={`text-xs mt-1 ${
                          msg.from === CURRENT_USER ? 'text-yellow-100' : 'text-gray-500'
                        }`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="p-3 border-t flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    onClick={sendMessage}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a conversation or start a new chat
              </div>
            )}
          </div>
        </div>

        {/* New Chat Modal */}
        {showNewChat && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 w-80">
              <h3 className="text-lg font-semibold mb-3">New Chat</h3>
              <select
                value={newChatUser}
                onChange={(e) => setNewChatUser(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-3"
              >
                <option value="">Select a user...</option>
                {availableUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewChat(false)}
                  className="px-3 py-2 bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={startNewChat}
                  className="px-3 py-2 bg-yellow-500 text-white rounded"
                >
                  Start Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
