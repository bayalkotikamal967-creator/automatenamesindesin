export interface GuestInvitation {
  id: string;
  name: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  dataUrl?: string; // Generated PNG Data URL
  fileName: string;
}

export interface AICaptionOption {
  text: string;
  category: 'polite' | 'friendly' | 'casual' | 'formal';
}

export interface CardDetails {
  location: string;
  date: string;
  time: string;
  host: string;
  tagline: string;
}
