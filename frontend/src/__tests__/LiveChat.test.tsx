import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import LiveChat from '@/components/Conversations/LiveChat';

// Mock scrollIntoView since jsdom doesn't support it
Element.prototype.scrollIntoView = jest.fn();

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock fetch to return conversation data
const mockConversationData = {
  conversation: { _id: 'conv1', phase: 'greeting' },
  messages: [],
  clinic: { id: 'c1', name: 'Cardiff Physiotherapy Centre', tone: 'friendly' },
  lead: {
    id: 'l1',
    firstName: 'Sarah',
    lastName: 'Williams',
    phone: '07700 900123',
    email: 'sarah@email.com',
    issue: 'Back Pain',
    postcode: 'CF10 3AB',
    leadSource: 'facebook',
  },
};

const mockGreetingResponse = {
  greeting: 'Hi Sarah! Thanks for getting in touch with Cardiff Physiotherapy Centre.',
};

beforeEach(() => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      json: () => Promise.resolve(mockConversationData),
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve(mockGreetingResponse),
    }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LiveChat', () => {
  it('renders the back link to conversations', async () => {
    render(<LiveChat conversationId="conv1" />);
    const link = screen.getByText(/Back to Conversations/);
    expect(link.closest('a')).toHaveAttribute('href', '/conversations');
  });

  it('shows Booking Assistant subtitle in chat header', async () => {
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText('AI Booking Assistant')).toBeInTheDocument();
    });
  });

  it('loads patient info into the sidebar', async () => {
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText('Patient Info')).toBeInTheDocument();
      expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
      expect(screen.getByText('Back Pain')).toBeInTheDocument();
    });
  });

  it('shows conversation phase in sidebar', async () => {
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText('Greeting')).toBeInTheDocument();
    });
  });

  it('auto-triggers the AI greeting on mount', async () => {
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText(/Hi Sarah! Thanks for getting in touch/)).toBeInTheDocument();
    });
  });

  it('calls the correct API endpoints', async () => {
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/conv1'),
      );
    });
  });

  it('shows error when backend is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as jest.Mock;
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText(/Could not connect to backend/)).toBeInTheDocument();
    });
  });

  it('does not show AI model references anywhere', async () => {
    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      const text = document.body.textContent ?? '';
      expect(text).not.toContain('Groq');
      expect(text).not.toContain('Llama');
      expect(text).not.toContain('GPT');
    });
  });

  it('loads existing messages without triggering greeting', async () => {
    const dataWithMessages = {
      ...mockConversationData,
      messages: [
        { id: 'm1', sender: 'ai', content: 'Welcome back!' },
        { id: 'm2', sender: 'lead', content: 'Hi there' },
      ],
    };
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(dataWithMessages),
    }) as jest.Mock;

    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText('Welcome back!')).toBeInTheDocument();
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
    // Should only call GET /conversations/:id, not POST /start
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sends a message and displays the AI reply', async () => {
    const mockReply = { reply: 'I can help with that!' };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockConversationData),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockGreetingResponse),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockReply),
      }) as jest.Mock;

    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText(/Hi Sarah/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'I need help' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('I need help')).toBeInTheDocument();
      expect(screen.getByText('I can help with that!')).toBeInTheDocument();
    });
  });

  it('shows error when greeting returns null', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockConversationData),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ greeting: null }),
      }) as jest.Mock;

    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate greeting/)).toBeInTheDocument();
    });
  });

  it('shows error when send message fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockConversationData),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockGreetingResponse),
      })
      .mockRejectedValueOnce(new Error('Network error')) as jest.Mock;

    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText(/Hi Sarah/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText(/Could not connect to backend/)).toBeInTheDocument();
    });
  });
  it('shows error when AI reply is null', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockConversationData),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockGreetingResponse),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ reply: null }),
      }) as jest.Mock;

    render(<LiveChat conversationId="conv1" />);
    await waitFor(() => {
      expect(screen.getByText(/Hi Sarah/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText(/AI failed to respond/)).toBeInTheDocument();
    });
  });
});
