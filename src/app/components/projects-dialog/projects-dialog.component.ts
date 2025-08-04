import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

interface Project {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

@Component({
  selector: 'app-projects-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './projects-dialog.component.html',
  styleUrls: ['./projects-dialog.component.css']
})
export class ProjectsDialogComponent implements OnInit {
  private supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );
  
  projects: Project[] = [];

  constructor(private dialogRef: MatDialogRef<ProjectsDialogComponent>) {}

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.projects = data || [];
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error);
    }
  }

  selectProject(project: Project) {
    this.dialogRef.close(project);
  }

  async deleteProject(projectId: string, event: MouseEvent) {
    event.stopPropagation();

    if (!confirm('wirklich projekt löschen?')) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      this.projects = this.projects.filter(p => p.id !== projectId);
    } catch (error) {
      console.error('Fehler beim Löschen des Projekts', error);
    }
  }
} 