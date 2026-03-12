import { render, screen } from '@testing-library/react';
import ConversationDetail from '@/components/Conversations/ConversationDetail';
import { mockConversationDetails } from '@/data/mockConversationDetails';

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

describe('ConversationDetail', () => {
  const sarahConversation = mockConversationDetails['conv_002'];

  it('renders the conversation title with patient name', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(
      screen.getByText('Conversation with Sarah Williams'),
    ).toBeInTheDocument();
  });

  it('displays the AI-generated greeting as the first message', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(
      screen.getByText(/Hi Sarah! Thanks for getting in touch/),
    ).toBeInTheDocument();
  });

  it('displays lead messages', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(
      screen.getByText(/I've had back pain for about a week/),
    ).toBeInTheDocument();
  });

  it('shows patient info card with details', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(screen.getByText('Patient Info')).toBeInTheDocument();
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.getByText('07700 900123')).toBeInTheDocument();
    expect(screen.getByText('sarah.williams@email.com')).toBeInTheDocument();
    expect(screen.getByText('Back Pain')).toBeInTheDocument();
  });

  it('shows conversation status card', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(screen.getByText('Conversation Status')).toBeInTheDocument();
    expect(
      screen.getByText('Cardiff Physiotherapy Centre'),
    ).toBeInTheDocument();
  });

  it('shows booking info when available', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(screen.getByText('Booking Info')).toBeInTheDocument();
    expect(screen.getByText('March 5, 2026')).toBeInTheDocument();
    expect(screen.getByText('2:00pm')).toBeInTheDocument();
    expect(screen.getByText('APT-001')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    expect(screen.getByText(/Flag for Review/)).toBeInTheDocument();
    expect(screen.getByText(/View in GHL/)).toBeInTheDocument();
  });

  it('has a back link to conversations list', () => {
    render(<ConversationDetail conversation={sarahConversation} />);
    const backLink = screen.getByText(/Back to Conversations/);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/conversations');
  });

  it('does not display any AI model references', () => {
    const { container } = render(
      <ConversationDetail conversation={sarahConversation} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('Groq');
    expect(text).not.toContain('Llama');
    expect(text).not.toContain('chatbot');
  });

  it('renders John Davies qualified conversation', () => {
    const johnConversation = mockConversationDetails['conv_003'];
    render(<ConversationDetail conversation={johnConversation} />);
    expect(
      screen.getByText('Conversation with John Davies'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/welcome to Newport Sports Clinic/),
    ).toBeInTheDocument();
  });

  it('renders Lisa Evans declined conversation', () => {
    const lisaConversation = mockConversationDetails['conv_004'];
    render(<ConversationDetail conversation={lisaConversation} />);
    expect(
      screen.getByText('Conversation with Lisa Evans'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/don't cover the SA2 area/),
    ).toBeInTheDocument();
  });

  it('does not show booking info for qualified conversations', () => {
    const johnConversation = mockConversationDetails['conv_003'];
    render(<ConversationDetail conversation={johnConversation} />);
    expect(screen.queryByText('Booking Info')).not.toBeInTheDocument();
  });
});
