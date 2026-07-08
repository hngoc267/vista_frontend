import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private apiUrl = 'http://localhost:5000/api/chatbot';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  createSession(): Observable<any> {
    return this.http.post(`${this.apiUrl}/sessions`, {}, { headers: this.getAuthHeaders() });
  }

  getSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions`, { headers: this.getAuthHeaders() });
  }


  getSessionMessages(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions/${sessionId}/messages`, { headers: this.getAuthHeaders() });
  }

  sendGuestMessage(content: string, history: any[]): Observable<any> {
  return this.http.post(`${this.apiUrl}/sessions/guest-message`, { content, history });
  }


  sendMessage(sessionId: string, content: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/sessions/${sessionId}/messages`,
      { content },
      { headers: this.getAuthHeaders() }
    );
  }


  deleteSession(sessionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sessions/${sessionId}`, { headers: this.getAuthHeaders() });
  }
}