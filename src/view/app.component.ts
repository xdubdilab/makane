import * as delay from 'delay'
import { Subscription } from 'rxjs'
import * as createDebug from 'debug'
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core'

import { AppService } from './app.service'
import {
  ProcessHandle,
  ProcessDescription,
  ProcessStatus,
  CreateProcessOptions,
} from '../common/types'

const debug = createDebug('makane:v:c:a')

export type ProcessViewRow = {
  readonly description: ProcessDescription
}

@Component({
  selector: 'app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {

  dataset: Array<ProcessViewRow> = []

  loading: boolean = false

  pageIndex: number = 1

  pageSize: number = 6

  private subscription = new Subscription()

  constructor(
    private zone: NgZone,
    private service: AppService,
    public detector: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.startHandlingProcessDescriptionActions()
    this.reload()
    debug('component initialized')
  }

  ngOnDestroy() {
    this.subscription.unsubscribe()
  }

  reload() {
    this.dataset = this.service.list().map(description => ({ description }))
  }

  startHandlingProcessDescriptionActions() {
    this.subscription.add(
      this.service.observeProcessDescriptionActions.
        filter(action => action.type === 'create').
        subscribe(({ payload: description }) => {
          this.dataset = this.dataset.concat([{ description }])
          debug('receive description create action (dataset -> %o): %o', this.dataset, description)
        })
    )
    this.subscription.add(
      this.service.observeProcessDescriptionActions.
        filter(action => action.type === 'remove').
        subscribe(({ payload: description }) => {
          this.dataset = this.dataset.filter(row =>
            row.description.handle !== description.handle
          )
          const maxPageIndex = Math.ceil(this.dataset.length / this.pageSize)
          if (this.pageIndex > maxPageIndex) {
            this.pageIndex = Math.max(0, this.pageIndex - 1)
          }
          debug('receive description remove action (dataset -> %o): %o', this.dataset, description)
        })
    )
    this.subscription.add(
      this.service.observeProcessDescriptionActions.
        filter(action => action.type === 'update').
        subscribe(({ payload: description }) => {
          this.zone.run(() => {
            this.dataset = this.dataset.map(row =>
              row.description.handle !== description.handle ? row : { ...row, description }
            )
          })
          debug('receive description update action (dataset -> %o): %o', this.dataset, description)
        })
    )
  }

  onClick() {
    debug('click..')
    this.onCreate({
      name: 'bash-t',
      command: 'bash',
      args: ['test/loop.sh'],
    })
  }

  onReload() {
    this.reload()
    this.loading = true
    delay(200).then(() => this.loading = false).catch(ignored => ignored)
  }

  onCreate(options: CreateProcessOptions) {
    this.service.create(options)
  }

  onRemove(handle: ProcessHandle) {
    this.service.remove(handle)
  }

  onRestart(handle: ProcessHandle) {
    this.service.restart(handle)
  }

  onStart(handle: ProcessHandle) {
    this.service.start(handle)
  }

  onStop(handle: ProcessHandle) {
    this.service.stop(handle)
  }

  isOnline(status: ProcessStatus) {
    const statuses: Array<ProcessStatus> = [
      'launching', 'online',
    ]
    return statuses.includes(status)
  }

  isOffline(status: ProcessStatus) {
    const statuses: Array<ProcessStatus> = [
      'uninitialized', 'stopping', 'stopped', 'errored',
    ]
    return statuses.includes(status)
  }

}
