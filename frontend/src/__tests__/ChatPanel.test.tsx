import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel, { DisplayMessage } from '@/components/Conversations/ChatPanel';

// Mock scrollIntoView since jsdom doesn't support it
Element.prototype.scrollIntoView = jest.fn();

const mockMessages: DisplayMessage[] = [
  { id: '1', sender: 'ai', content: 'Hello, how can I help?' },
  { id: '2', sender: 'lead', content: 'I have back pain' },
];

const defaultProps = {
  messages: mockMessages,
  loading: false,
  error: null,
  input: '',
  clinicName: 'Cardiff Physiotherapy Centre',
  onInputChange: jest.fn(),
  onSend: jest.fn(),
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('ChatPanel', () => {
  it('renders the clinic name in the header', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
  });

  it('renders Booking Assistant subtitle', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText('AI Booking Assistant')).toBeInTheDocument();
  });

  it('renders all messages', () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument();
    expect(screen.getByText('I have back pain')).toBeInTheDocument();
  });

  it('shows typing indicator when loading', () => {
    render(<ChatPanel {...defaultProps} loading={true} />);
    expect(screen.getByLabelText('AI is typing')).toBeInTheDocument();
  });

  it('hides typing indicator when not loading', () => {
    render(<ChatPanel {...defaultProps} loading={false} />);
    expect(screen.queryByLabelText('AI is typing')).not.toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    render(<ChatPanel {...defaultProps} error="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('calls onInputChange when typing in the input', () => {
    const onInputChange = jest.fn();
    render(<ChatPanel {...defaultProps} onInputChange={onInputChange} />);
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(onInputChange).toHaveBeenCalledWith('Hello');
  });

  it('calls onSend when Send button is clicked', () => {
    const onSend = jest.fn();
    render(<ChatPanel {...defaultProps} input="Hello" onSend={onSend} />);
    fireEvent.click(screen.getByText('Send'));
    expect(onSend).toHaveBeenCalled();
  });

  it('disables Send button when input is empty', () => {
    render(<ChatPanel {...defaultProps} input="" />);
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('disables input and Send button when loading', () => {
    render(<ChatPanel {...defaultProps} loading={true} input="Hello" />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeDisabled();
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('calls onSend when Enter key is pressed', () => {
    const onSend = jest.fn();
    render(<ChatPanel {...defaultProps} input="Hello" onSend={onSend} />);
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalled();
  });

  it('does not call onSend when Shift+Enter is pressed', () => {
    const onSend = jest.fn();
    render(<ChatPanel {...defaultProps} input="Hello" onSend={onSend} />);
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});
