import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment.development';
import { BehaviorSubject } from 'rxjs';

export interface List {
  id: number;
  title: string;
  position: number;
  created_at: string;
}

export interface Card {
  id: number;
  list_id: number;
  title: string;
  description?: string;
  due_date?: string;
  position: number;
  is_completed: boolean;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private listsSubject = new BehaviorSubject<List[]>([]);
  private cardsSubject = new BehaviorSubject<{[key: number]: Card[]}>({});

  lists$ = this.listsSubject.asObservable();
  cards$ = this.cardsSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
    this.loadInitialData();
  }

  private async loadInitialData() {
    await this.loadLists(1);
    const lists = this.listsSubject.value;
    for (const list of lists) {
      await this.loadCards(list.id);
    }
  }

  // Proje işlemleri
  async loadProjectDetails(projectId: number) {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('title')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Proje detayları yüklenirken hata:', error);
      return null;
    }
  }

  // Liste işlemleri
  async loadLists(projectId: number) {
    try {
      const { data, error } = await this.supabase
        .from('lists')
        .select('*')
        .eq('project_id', projectId)
        .order('position');
      
      if (error) throw error;
      this.listsSubject.next(data || []);
      return data;
    } catch (error) {
      console.error('fehler bei upload: ', error);
      return [];
    }
  }

  async createList(title: string, projectId: number) {
    try {
      const position = await this.getNextListPosition(projectId);
      const { data, error } = await this.supabase
        .from('lists')
        .insert([{ 
          title, 
          position, 
          project_id: projectId 
        }])
        .select()
        .single();

      if (error) throw error;
      
      const currentLists = this.listsSubject.value;
      this.listsSubject.next([...currentLists, data]);
      return data;
    } catch (error) {
      console.error('Liste oluşturulurken hata:', error);
      return null;
    }
  }

  async updateList(id: number, updates: Partial<List>) {
    try {
      const { data, error } = await this.supabase
        .from('lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const currentLists = this.listsSubject.value;
      const updatedLists = currentLists.map(list => 
        list.id === id ? { ...list, ...data } : list
      );
      this.listsSubject.next(updatedLists);
      return data;
    } catch (error) {
      console.error('Liste güncellenirken hata:', error);
      return null;
    }
  }

  async deleteList(id: number) {
    try {
      const { error } = await this.supabase
        .from('lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const currentLists = this.listsSubject.value;
      this.listsSubject.next(currentLists.filter(list => list.id !== id));
      
      const currentCards = this.cardsSubject.value;
      delete currentCards[id];
      this.cardsSubject.next({ ...currentCards });
    } catch (error) {
      console.error('Liste silinirken hata:', error);
    }
  }

  // Kart işlemleri
  async loadCards(listId: number) {
    try {
      const { data, error } = await this.supabase
        .from('cards')
        .select('*')
        .eq('list_id', listId)
        .order('position');
      
      if (error) throw error;

      const currentCards = this.cardsSubject.value;
      this.cardsSubject.next({
        ...currentCards,
        [listId]: data || []
      });
      return data;
    } catch (error) {
      console.error('Kartlar yüklenirken hata:', error);
      return [];
    }
  }

  async createCard(listId: number, title: string, description?: string, dueDate?: string) {
    try {
      const position = await this.getNextCardPosition(listId);
      const { data, error } = await this.supabase
        .from('cards')
        .insert([{
          list_id: listId,
          title,
          description,
          due_date: dueDate,
          position,
          is_completed: false,
          status: 'todo'
        }])
        .select()
        .single();

      if (error) throw error;

      const currentCards = this.cardsSubject.value;
      const listCards = currentCards[listId] || [];
      this.cardsSubject.next({
        ...currentCards,
        [listId]: [...listCards, data]
      });
      return data;
    } catch (error) {
      console.error('Kart oluşturulurken hata:', error);
      return null;
    }
  }

  async updateCard(cardId: number, updates: Partial<Card>) {
    try {
      const { data, error } = await this.supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;

      const currentCards = this.cardsSubject.value;
      const listId = data.list_id;
      const listCards = currentCards[listId] || [];
      const updatedCards = listCards.map(card =>
        card.id === cardId ? { ...card, ...data } : card
      );

      this.cardsSubject.next({
        ...currentCards,
        [listId]: updatedCards
      });
      return data;
    } catch (error) {
      console.error('Kart güncellenirken hata:', error);
      return null;
    }
  }

  async deleteCard(cardId: number, listId: number) {
    try {
      const { error } = await this.supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;

      const currentCards = this.cardsSubject.value;
      const listCards = currentCards[listId] || [];
      this.cardsSubject.next({
        ...currentCards,
        [listId]: listCards.filter(card => card.id !== cardId)
      });
    } catch (error) {
      console.error('Kart silinirken hata:', error);
    }
  }

  // Yardımcı fonksiyonlar
  private async getNextListPosition(projectId: number): Promise<number> {
    const { data } = await this.supabase
      .from('lists')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1);
    
    return data && data.length > 0 ? data[0].position + 1 : 0;
  }

  private async getNextCardPosition(listId: number): Promise<number> {
    const { data } = await this.supabase
      .from('cards')
      .select('position')
      .eq('list_id', listId)
      .order('position', { ascending: false })
      .limit(1);
    
    return data && data.length > 0 ? data[0].position + 1 : 0;
  }
} 