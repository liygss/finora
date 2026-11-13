export function openChatbot(detail = {}) {
  window.dispatchEvent(new CustomEvent('open-chatbot', { detail }))
}

export function openTaxConsultation() {
  openChatbot({ taxConsult: true })
}

export function askTaxQuestion(prompt) {
  openChatbot({ prompt, autoSend: true })
}
