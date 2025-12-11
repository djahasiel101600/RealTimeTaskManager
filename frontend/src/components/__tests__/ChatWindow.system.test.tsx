/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ChatWindow } from '../ChatWindow';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { vi, beforeEach, afterEach, it, expect } from 'vitest';

// Mock the WebSocket hook so tests do not attempt network connections
vi.mock('@/hooks/useWebSocket', () => ({
	useWebSocket: () => ({
		joinRoom: vi.fn(),
		leaveRoom: vi.fn(),
		sendMessage: vi.fn(),
		sendTypingIndicator: vi.fn(),
		chatStatus: 'disconnected',
		notificationStatus: 'disconnected',
		isChatConnected: false,
		isNotificationsConnected: false,
	})
}));

const resetStores = () => {
	useChatStore.setState({
		rooms: [],
		activeRoom: null,
		messages: [],
		typingUsers: {},
		isLoading: false,
		isLoadingMore: false,
		error: null,
		currentPage: 1,
		hasMore: false,
		// Provide noop implementations for async actions to avoid network calls during tests
		fetchRooms: async () => { return; },
		fetchRoom: async (_roomId: number) => (null as any),
		fetchMessages: async (_roomId: number) => ([] as any),
		loadMoreMessages: async (_roomId: number) => { return; },
		addMessage: (_message: any) => { return; },
		sendMessage: async (_roomId: number, _content: string, _attachments?: File[]) => ({} as any),
		createDirectRoom: async (_userId: number) => (null as any),
		markMessagesAsRead: async (_roomId: number) => { return; },
		updateTypingStatus: (_userId: number, _isTyping: boolean, _roomId?: number) => { return; },
		setActiveRoom: (room: any) => { useChatStore.setState({ activeRoom: room, messages: [] }); },
	});

	useAuthStore.setState({ user: null, isAuthenticated: false });
};

beforeEach(() => {
	resetStores();
	// Mock scrollIntoView used by ChatWindow (jsdom may not provide a real implementation)
	(window as any).HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
	vi.restoreAllMocks();
});

it('renders a system message centered and with muted style', async () => {
	// Arrange: set authenticated user and active room in stores
	useAuthStore.setState({ user: { id: 2, username: 'alice', email: 'a@example.com', role: 'clerk', is_online: true } as any, isAuthenticated: true });
	const room = { id: 123, room_type: 'task', name: 'Task 123', participants: [], unread_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any;
	// Directly set activeRoom and messages to avoid triggering network calls
	const systemMessage = {
		id: 9999,
		content: 'Due date changed to 2025-12-30',
		sender: { id: 0, username: 'System', email: '', role: 'clerk', is_online: false },
		room: room.id,
		attachments: [],
		timestamp: new Date().toISOString(),
		is_read: false,
		is_system: true,
	} as any;

	useChatStore.setState({ activeRoom: room, messages: [systemMessage] });

	// Act: render the component
	render(<ChatWindow roomId={room.id} roomType={'task'} />);

	// Assert: system message content is shown and centered (muted text)
	const content = await screen.findByText('Due date changed to 2025-12-30');
	expect(content).toBeTruthy();

	// timestamp displayed in HH:mm (24-hour) format
	const timeString = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(systemMessage.timestamp));
	const timeRegex = new RegExp(timeString.replace(/\u200E/g, ''));
	const timeElem = screen.getByText(timeRegex);
	expect(timeElem).toBeTruthy();
});
