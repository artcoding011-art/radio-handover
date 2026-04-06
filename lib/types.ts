export interface ColumnValues {
  매체: string
  '1R': string
  '2R': string
  MFM: string
}

export interface ScheduleProgram {
  id: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  programName: string;
}

export type WeeklyScheduleData = {
  [medium in '1R' | '2R' | 'MFM']: {
    [day in 0 | 1 | 2 | 3 | 4 | 5 | 6]: ScheduleProgram[];
  }
}

export interface DailyScheduleData {
  '1R': ScheduleProgram[];
  '2R': ScheduleProgram[];
  MFM: ScheduleProgram[];
  canceledWeeklyIds?: string[];
  completedProgramIds?: string[];
}

export interface TaskItem {
  id: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  taskName: string;
}

export type WeeklyTaskData = {
  [day in 0 | 1 | 2 | 3 | 4 | 5 | 6]: TaskItem[];
}

export interface DailyTaskData {
  tasks: TaskItem[];
  canceledWeeklyIds?: string[];
  completedTaskIds?: string[];
}

export type WorkShift = '오전(09:00~14:00)' | '오후(14:00~18:00)' | '종일(09:00~18:00)';
export type StaffRole = '주 근무자' | '부 근무자';

export interface GlobalStaff {
  id: string;
  name: string;
  role: StaffRole;
  color: string;
}

export interface StaffAssignment {
  id: string;
  staffId?: string;
  name: string;
  role: StaffRole;
  shift: WorkShift;
  color: string;
}

export interface DailyStaffData {
  assignments: StaffAssignment[];
}

export interface HandoverEntry {
  date: string // YYYY-MM-DD
  근무자: string
  결재자: string
  서명: string // 디지털 사인 (Data URL)
  rStudio: {
    일일편성정보확인: ColumnValues
    현업주요사항: string
    체크항목: {
      mixer: ColumnValues
      display모니터: ColumnValues
      로컬녹음단말: ColumnValues
      ST내부모니터: ColumnValues
    }
  }
  rMCR: {
    모니터: ColumnValues
    매체별송출서버: ColumnValues
    디스플레이서버시간성보: ColumnValues
    편성단말: ColumnValues
    특이사항: string
  }
  afs: {
    라우터: ColumnValues
    CASS: ColumnValues
    '1R_MFM송출서버': ColumnValues
    '2R송출서버': ColumnValues
    디스플레이서버: ColumnValues
    편성단말: ColumnValues
    DB서버: ColumnValues
    네트워크스위치: ColumnValues
    통합제어디코더: ColumnValues
  }
  createdAt: string
  updatedAt: string
}

export const defaultColumnValues: ColumnValues = {
  매체: '정상',
  '1R': '정상',
  '2R': '정상',
  MFM: '정상',
}

export function createEmptyEntry(date: string): HandoverEntry {
  return {
    date,
    근무자: '',
    결재자: '',
    서명: '',
    rStudio: {
      일일편성정보확인: { ...defaultColumnValues },
      현업주요사항: '',
      체크항목: {
        mixer: { ...defaultColumnValues },
        display모니터: { ...defaultColumnValues },
        로컬녹음단말: { ...defaultColumnValues },
        ST내부모니터: { ...defaultColumnValues },
      },
    },
    rMCR: {
      모니터: { ...defaultColumnValues },
      매체별송출서버: { ...defaultColumnValues },
      디스플레이서버시간성보: { ...defaultColumnValues },
      편성단말: { ...defaultColumnValues },
      특이사항: '',
    },
    afs: {
      라우터: { ...defaultColumnValues },
      CASS: { ...defaultColumnValues },
      '1R_MFM송출서버': { ...defaultColumnValues },
      '2R송출서버': { ...defaultColumnValues },
      디스플레이서버: { ...defaultColumnValues },
      편성단말: { ...defaultColumnValues },
      DB서버: { ...defaultColumnValues },
      네트워크스위치: { ...defaultColumnValues },
      통합제어디코더: { ...defaultColumnValues },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export interface MwDataRow {
  isOperating: boolean;
  pd: string;
  mpx: string;
  leftLvl: string;
  rightLvl: string;
  vs2: string;
  vsPlus: string;
  vsMinus: string;
  t: string;
}

export interface MwInspectionData {
  time: string;
  temperature: string;
  humidity: string;
  inspector: string;
  '1R_TX1': MwDataRow;
  '1R_TX2': MwDataRow;
  '2R_TX1': MwDataRow;
  '2R_TX2': MwDataRow;
  'MFM_TX1': MwDataRow;
  'MFM_TX2': MwDataRow;
}

