import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { SupabaseService, List } from '../../services/supabase.service';
import { ActivatedRoute } from '@angular/router';

interface Card {
  id: number;
  list_id: number;
  title: string;
  description?: string;
  due_date?: string;
  position: number;
  is_completed: boolean;
  status: CardStatus;
  created_at: string;
}

type CardStatus = 'todo' | 'in_progress' | 'review' | 'done';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatDatepickerModule,
    MatInputModule,
    MatFormFieldModule,
    MatNativeDateModule,
    DragDropModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Temel özellikler
  projectId: number | null = null;
  projectTitle: string = '';
  lists: List[] = [];
  cards: { [key: number]: Card[] } = {};

  // Form kontrolleri
  newListTitle: string = '';
  newCardTitle: string = '';
  newCardDueDate: Date | null = null;
  showAddCard: { [key: number]: boolean } = {};

  // Sabit değerler
  readonly cardStatuses: CardStatus[] = ['todo', 'in_progress', 'review', 'done'];
  private readonly STATUS_COLORS: Record<CardStatus, string> = {
    todo: '#6c757d',
    in_progress: '#007bff',
    review: '#ffc107',
    done: '#28a745'
  };

  private readonly STATUS_TEXTS: Record<CardStatus, string> = {
    todo: 'todo',
    in_progress: 'in progress',
    review: 'review',
    done: 'done'
  };

  constructor(
    private supabaseService: SupabaseService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initializeProject();
  }

  // Proje yükleme
  private async initializeProject(): Promise<void> {
    this.route.queryParams.subscribe(async params => {
      const projectId = params['projectId'];
      if (projectId) {
        this.projectId = parseInt(projectId);
        await Promise.all([
          this.loadProjectDetails(),
          this.loadLists()
        ]);
      }
    });
  }

  private async loadProjectDetails(): Promise<void> {
    if (!this.projectId) return;
    
    try {
      const data = await this.supabaseService.loadProjectDetails(this.projectId);
      if (data) {
        this.projectTitle = data.title;
      }
    } catch (error) {
      console.error('Fehler beim Laden der Projektdetails:', error);
    }
  }

  private async loadLists(): Promise<void> {
    if (!this.projectId) return;

    try {
      const lists = await this.supabaseService.loadLists(this.projectId);
      this.lists = lists;
      
      await Promise.all(
        lists.map(list => this.loadCardsForList(list.id))
      );
    } catch (error) {
      console.error('fdehler beim hochladen der karte:', error);
    }
  }

  private async loadCardsForList(listId: number): Promise<void> {
    try {
      const cards = await this.supabaseService.loadCards(listId);
      this.cards[listId] = cards;
    } catch (error) {
      console.error(`Fehler beim Laden der Karten für Liste ${listId}:`, error);
    }
  }

  // Liste işlemleri
  async addList(): Promise<void> {
    if (!this.newListTitle?.trim() || !this.projectId) return;
    
    try {
      const data = await this.supabaseService.createList(this.newListTitle, this.projectId);
      if (data) {
        this.lists = [...this.lists, data];
        this.cards[data.id] = [];
        this.newListTitle = '';
      }
    } catch (error) {
      console.error('fehleer bei listen erstellung:', error);
    }
  }

  async deleteList(id: number): Promise<void> {
    try {
      await this.supabaseService.deleteList(id);
      this.lists = this.lists.filter(list => list.id !== id);
      delete this.cards[id];
    } catch (error) {
      console.error('fehleer bei listen erstellung ', error);
    }
  }

  // Kart işlemleri
  async addCard(listId: number): Promise<void> {
    if (!this.newCardTitle?.trim()) return;
    
    try {
      const dueDate = this.newCardDueDate ? 
        this.newCardDueDate.toISOString().split('T')[0] : 
        undefined;

      const card = await this.supabaseService.createCard(listId, this.newCardTitle, undefined, dueDate);
      if (card) {
        this.cards[listId] = [...(this.cards[listId] || []), card];
        this.resetCardForm(listId);
      }
    } catch (error) {
      console.error('fehler bei karten erstellung:', error);
    }
  }

  async deleteCard(card: Card): Promise<void> {
    try {
      await this.supabaseService.deleteCard(card.id, card.list_id);
      this.cards[card.list_id] = this.cards[card.list_id].filter(c => c.id !== card.id);
    } catch (error) {
      console.error('fehler beim lsöchen:', error);
    }
  }

  async updateCardStatus(card: Card, status: CardStatus): Promise<void> {
    try {
      const updatedCard = await this.supabaseService.updateCard(card.id, { 
        status,
        is_completed: status === 'done'
      });

      if (updatedCard) {
        const listCards = this.cards[card.list_id];
        const index = listCards.findIndex(c => c.id === card.id);
        if (index !== -1) {
          this.cards[card.list_id] = [
            ...listCards.slice(0, index),
            updatedCard,
            ...listCards.slice(index + 1)
          ];
        }
      }
    } catch (error) {
      console.error('Kart durumu güncellenirken hata:', error);
    }
  }

  // Sürükleme işlemleri
  async onCardDrop(event: CdkDragDrop<Card[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      await this.updateCardPositions(event.container.data);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      const card = event.container.data[event.currentIndex];
      const newListId = parseInt(event.container.id);
      
      await this.updateCardListAndPosition(card, newListId, event.currentIndex);
      await this.updateCardPositions(event.container.data.filter(c => c.id !== card.id));
    }
  }

  async onListDrop(event: CdkDragDrop<List[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;

    moveItemInArray(
      this.lists,
      event.previousIndex,
      event.currentIndex
    );

    await this.updateListPositions();
  }

  // Yardımcı metodlar
  getCardCount(listId: number): number {
    return this.cards[listId]?.length || 0;
  }

  toggleAddCard(listId: number): void {
    this.showAddCard[listId] = !this.showAddCard[listId];
    if (!this.showAddCard[listId]) {
      this.resetCardForm(listId);
    }
  }

  getStatusColor(status: CardStatus): string {
    return this.STATUS_COLORS[status];
  }

  getStatusText(status: CardStatus): string {
    return this.STATUS_TEXTS[status];
  }

  trackByListId(index: number, list: List): number {
    return list.id;
  }

  trackByCardId(index: number, card: Card): number {
    return card.id;
  }

  // Private yardımcı metodlar
  private resetCardForm(listId: number): void {
    this.newCardTitle = '';
    this.newCardDueDate = null;
    this.showAddCard[listId] = false;
  }

  private async updateCardPositions(cards: Card[]): Promise<void> {
    const updates = cards.map((card, index) => 
      this.supabaseService.updateCard(card.id, { position: index })
    );
    await Promise.all(updates);
  }

  private async updateCardListAndPosition(card: Card, listId: number, position: number): Promise<void> {
    await this.supabaseService.updateCard(card.id, {
      list_id: listId,
      position
    });
  }

  private async updateListPositions(): Promise<void> {
    const updates = this.lists.map((list, index) =>
      this.supabaseService.updateList(list.id, { position: index })
    );
    await Promise.all(updates);
  }
}
