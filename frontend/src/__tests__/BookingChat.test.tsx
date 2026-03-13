import { render, screen, waitFor } from '@testing-library/react';
import BookingChat from '@/components/Conversations/BookingChat';

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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BookingChat', () => {
  it('shows loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<BookingChat leadName="Rachel Green" clinicName="Newport Sports Clinic" />);
    expect(screen.getByText('Loading conversation...')).toBeInTheDocument();
  });

  it('finds the matching conversation and renders LiveChat', async () => {
    const mockConversations = [
      {
        _id: 'mongo_123',
        leadId: { firstName: 'Rachel', lastName: 'Green' },
        clinicId: { name: 'Newport Sports Clinic' },
        phase: 'greeting',
      },
    ];

    global.fetch = jest.fn()
      // First call: BookingChat fetches conversation list
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockConversations),
      })
      // Second call: LiveChat fetches conversation details
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          conversation: { _id: 'mongo_123', phase: 'greeting' },
          messages: [],
          clinic: { name: 'Newport Sports Clinic' },
          lead: { firstName: 'Rachel', lastName: 'Green', issue: 'Shoulder pain' },
        }),
      })
      // Third call: LiveChat triggers greeting
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ greeting: 'Hello Rachel!' }),
      }) as jest.Mock;

    render(<BookingChat leadName="Rachel Green" clinicName="Newport Sports Clinic" />);

    await waitFor(() => {
      expect(screen.getByText('AI Booking Assistant')).toBeInTheDocument();
    });
  });

  it('shows error when conversation not found', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve([]),
    }) as jest.Mock;

    render(<BookingChat leadName="Unknown Person" clinicName="Unknown Clinic" />);

    await waitFor(() => {
      expect(screen.getByText(/Could not find a conversation/)).toBeInTheDocument();
    });
  });

  it('shows error when backend is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(
      new Error('Network error'),
    ) as jest.Mock;

    render(<BookingChat leadName="Rachel Green" clinicName="Newport Sports Clinic" />);

    await waitFor(() => {
      expect(screen.getByText(/Could not connect to backend/)).toBeInTheDocument();
    });
  });
});
