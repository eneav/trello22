import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CreateProjectDialogComponent } from '../create-project-dialog/create-project-dialog.component';
import { ProjectsDialogComponent } from '../projects-dialog/projects-dialog.component';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

interface List {
  id: number;
  title: string;
  project_id: number;
  position: number;
  created_at: string;
  project_title?: string;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule]
})
export class NavbarComponent {
  private supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );

  searchQuery: string = '';
  searchResults: List[] = [];
  showSearchResults: boolean = false;

  constructor(
    private dialog: MatDialog,
    private router: Router
  ) {}

  async searchLists() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    try {
      const { data, error } = await this.supabase
        .from('lists')
        .select(`
          *,
          projects:project_id (
            title
          )
        `)
        .ilike('title', `%${this.searchQuery}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      this.searchResults = (data || []).map(list => ({
        ...list,
        project_title: list.projects.title
      }));
      this.showSearchResults = true;
    } catch (error) {
      console.error('fehler in der suche :', error);
    }
  }

  selectSearchResult(list: List) {
    this.router.navigate(['/dashboard'], { queryParams: { projectId: list.project_id } });
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  closeSearchResults() {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }

  openProjectsDialog() {
    const dialogRef = this.dialog.open(ProjectsDialogComponent, {
      width: '600px'
    });

    dialogRef.afterClosed().subscribe(project => {
      if (project) {
        this.router.navigate(['/dashboard'], { queryParams: { projectId: project.id } });
      }
    });
  }

  openCreateProjectDialog() {
    const dialogRef = this.dialog.open(CreateProjectDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          const { data, error } = await this.supabase
            .from('projects')
            .insert([{
              title: result.title,
              description: result.description
            }])
            .select()
            .single();

          if (error) throw error;
          console.log('Das Projekt wurde erfolgreich erstellt.:', data);
        } catch (error) {
          console.error('Fehler beim Erstellen des Projekts:', error);
        }
      }
    });
  }
}
