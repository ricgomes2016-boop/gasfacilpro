export function speakAssistantText(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) return false;
  speechSynthesis.cancel();
  const clean = text
    .replace(/\[CHART_META\].*?\[\/CHART_META\]/gs, "")
    .replace(/\[PENDING_ACTIONS\].*?\[\/PENDING_ACTIONS\]/gs, "")
    .replace(/[#*_`~[\]()>|]/g, "")
    .replace(/\n+/g, ". ")
    .slice(0, 3000);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "pt-BR";
  utterance.rate = 1.05;
  utterance.pitch = 1;
  const voices = speechSynthesis.getVoices();
  const ptVoice =
    voices.find((voice) => voice.lang.startsWith("pt-BR")) ||
    voices.find((voice) => voice.lang.startsWith("pt"));
  if (ptVoice) utterance.voice = ptVoice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  speechSynthesis.speak(utterance);
  return true;
}
