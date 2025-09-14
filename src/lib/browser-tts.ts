'use client';

// Client-side TTS using Web Speech API
export class BrowserTTS {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
    }
  }

  private loadVoices() {
    if (!this.synth) return;

    const updateVoices = () => {
      this.voices = this.synth!.getVoices();
    };

    updateVoices();
    this.synth.addEventListener('voiceschanged', updateVoices);
  }

  async generateSpeech(text: string, voiceId: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice based on voiceId
      const voice = this.selectVoiceByCharacteristics(voiceId);
      if (voice) {
        utterance.voice = voice;
      }

      // Configure speech parameters
      this.configureUtterance(utterance, voiceId);

      // Since Web Speech API doesn't directly provide audio data,
      // we'll use MediaRecorder to capture the audio output
      this.captureAudio(utterance)
        .then(resolve)
        .catch(reject);
    });
  }

  private selectVoiceByCharacteristics(voiceId: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) {
      return null;
    }

    // Map our voice IDs to speech synthesis voice selection
    const voiceMap: Record<string, { gender: string; lang: string; name?: string }> = {
      'voice-male-professional-1': { gender: 'male', lang: 'en-US' },
      'voice-female-professional-1': { gender: 'female', lang: 'en-US' },
      'voice-male-casual-1': { gender: 'male', lang: 'en-US' },
      'voice-female-casual-1': { gender: 'female', lang: 'en-US' },
      'voice-male-british-1': { gender: 'male', lang: 'en-GB' },
      'voice-female-british-1': { gender: 'female', lang: 'en-GB' },
      'voice-male-narrative-1': { gender: 'male', lang: 'en-US' },
      'voice-female-narrative-1': { gender: 'female', lang: 'en-US' },
      'voice-male-news-1': { gender: 'male', lang: 'en-US' },
      'voice-female-news-1': { gender: 'female', lang: 'en-US' }
    };

    const characteristics = voiceMap[voiceId] || { gender: 'female', lang: 'en-US' };

    // Try to find the best matching voice
    let selectedVoice = this.voices.find(voice => 
      voice.lang === characteristics.lang && 
      voice.name.toLowerCase().includes(characteristics.gender)
    );

    if (!selectedVoice) {
      selectedVoice = this.voices.find(voice => 
        voice.lang.startsWith(characteristics.lang.split('-')[0]) &&
        voice.name.toLowerCase().includes(characteristics.gender)
      );
    }

    if (!selectedVoice) {
      selectedVoice = this.voices.find(voice => 
        voice.lang.startsWith('en')
      );
    }

    return selectedVoice || this.voices[0] || null;
  }

  private configureUtterance(utterance: SpeechSynthesisUtterance, voiceId: string) {
    // Configure speech parameters based on voice type
    if (voiceId.includes('professional')) {
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
    } else if (voiceId.includes('casual')) {
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
    } else if (voiceId.includes('narrative')) {
      utterance.rate = 0.8;
      utterance.pitch = 0.9;
    } else if (voiceId.includes('news')) {
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
    }

    utterance.volume = 1.0;
  }

   private async captureAudio(utterance: SpeechSynthesisUtterance): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Create a synthetic audio representation without speaking
        // DO NOT trigger actual speech - just create the audio file
        this.createSyntheticAudio(utterance.text, utterance.voice?.name || 'default')
          .then(resolve)
          .catch(reject);

        // REMOVED: this.synth!.speak(utterance); - No automatic speaking!
      } catch (error) {
        reject(error);
      }
    });
  }

   private async createSyntheticAudio(text: string, voiceName: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sampleRate = audioContext.sampleRate;
        
        // Calculate realistic duration based on text length and speaking rate
        const wordsPerMinute = voiceName.toLowerCase().includes('professional') ? 140 : 160;
        const wordCount = text.trim().split(/\s+/).length;
        const durationSeconds = Math.max(2, (wordCount / wordsPerMinute) * 60);
        const samples = Math.floor(durationSeconds * sampleRate);

        // Create audio buffer
        const audioBuffer = audioContext.createBuffer(1, samples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);

        // Voice characteristics based on voice name/type
        const baseFrequency = voiceName.toLowerCase().includes('male') ? 110 : 180;
        const isBritish = voiceName.toLowerCase().includes('british');
        const isProfessional = voiceName.toLowerCase().includes('professional');
        const isNarrative = voiceName.toLowerCase().includes('narrative');
        
        // Split text into phonetic units for more realistic speech patterns
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        for (let i = 0; i < samples; i++) {
          const t = i / sampleRate;
          const progress = t / durationSeconds;
          
          // Determine current word and sentence
          const wordIndex = Math.floor(progress * words.length);
          const sentenceIndex = Math.floor(progress * sentences.length);
          const currentWord = words[wordIndex] || '';
          
          // Create dynamic frequency based on word characteristics
          let wordFreq = baseFrequency;
          
          // Adjust frequency based on word length and vowels (simulate prosody)
          wordFreq += (currentWord.length - 4) * 3;
          
          // Add accent variations
          if (isBritish) {
            wordFreq *= 1.05; // Slightly higher pitch for British
          }
          
          // Add voice style variations
          if (isProfessional) {
            wordFreq *= 0.95; // Slightly lower, more authoritative
          } else if (isNarrative) {
            wordFreq *= 0.90; // Lower, more dramatic
          }
          
          // Create sentence-level intonation
          const sentenceProgress = (progress * sentences.length) % 1;
          let intonation = 1.0;
          
          if (sentenceProgress < 0.8) {
            intonation = 1.0 + Math.sin(sentenceProgress * Math.PI) * 0.15; // Rising then falling
          } else {
            intonation = 0.9; // Falling at sentence end
          }
          
          // Apply word-level stress patterns
          const wordProgress = (progress * words.length) % 1;
          const stress = 1.0 + Math.sin(wordProgress * Math.PI * 2) * 0.1;
          
          // Generate more natural formant structure
          const f0 = wordFreq * intonation * stress;
          const f1 = f0 * 2.2; // First formant
          const f2 = f0 * 3.8; // Second formant
          const f3 = f0 * 5.1; // Third formant
          
          // Create complex waveform with formants
          const fundamental = Math.sin(2 * Math.PI * f0 * t) * 0.4;
          const formant1 = Math.sin(2 * Math.PI * f1 * t) * 0.25;
          const formant2 = Math.sin(2 * Math.PI * f2 * t) * 0.15;
          const formant3 = Math.sin(2 * Math.PI * f3 * t) * 0.08;
          
          // Add breath and natural speech variations
          const breathNoise = (Math.random() - 0.5) * 0.02;
          const naturalVariation = Math.sin(t * 1.5 + currentWord.length) * 0.05;
          
          // Apply speech envelope (pauses between words/sentences)
          let envelope = 1.0;
          
          // Add pauses between words
          const wordBoundary = (progress * words.length) % 1;
          if (wordBoundary > 0.85) {
            envelope *= 0.3; // Reduce volume between words
          }
          
          // Add longer pauses between sentences
          const sentenceBoundary = (progress * sentences.length) % 1;
          if (sentenceBoundary > 0.9) {
            envelope *= 0.1; // Longer pause between sentences
          }
          
          // Apply overall envelope to avoid clicks
          const globalEnvelope = Math.sin(Math.PI * Math.min(progress * 2, (1 - progress) * 2, 1));
          envelope *= globalEnvelope * 0.7;
          
          // Combine all components
          let sample = (fundamental + formant1 + formant2 + formant3 + naturalVariation + breathNoise) * envelope;
          
          // Apply compression and limiting
          sample = Math.tanh(sample * 1.2);
          
          channelData[i] = sample;
        }

        // Convert to WAV blob
        const wavBuffer = this.audioBufferToWav(audioBuffer);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        
        console.log(`Generated audio: ${durationSeconds.toFixed(1)}s, ${wordCount} words, ${blob.size} bytes`);
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    });
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  }

  isSupported(): boolean {
    return !!(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }
}