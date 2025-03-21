// =========================================================
// 상수 정의
// =========================================================
const ROLES = {
  ADMIN: 'admin',
  EDUCATION_COUNSELOR: 'education_counselor',
  EDUCATION_COUNSELOR_LEADER: 'education_counselor_leader',
  LEARNING_MANAGER: 'learning_manager',
  LEARNING_MANAGER_LEADER: 'learning_manager_leader'
} as const;

const ACTIONS = {
  INQUIRY: {
    CREATE: 'inquiry:create',
    READ: 'inquiry:read',
    UPDATE: 'inquiry:update',
    DELETE: 'inquiry:delete',
    ASSIGN: 'inquiry:assign',
    RESOLVE: 'inquiry:resolve',
    MODIFY_ASSIGNEE: 'inquiry:modify_assignee'
  },
  STUDENT: {
    CREATE: 'student:create',
    READ: 'student:read',
    UPDATE: 'student:update',
    DELETE: 'student:delete',
    ASSIGN_CONSULTANT: 'student:assign_consultant'
  },
  CONSULTATION: {
    CREATE: 'consultation:create',
    READ: 'consultation:read',
    UPDATE: 'consultation:update',
    DELETE: 'consultation:delete',
    SCHEDULE: 'consultation:schedule',
    COMPLETE: 'consultation:complete'
  }
} as const;

const QUESTION_TARGETS = {
  CONSULTANT_INQUIRY: 'consultant_inquiry',
  TM_INQUIRY: 'tm_inquiry',
  GENERAL_INQUIRY: 'general_inquiry'
} as const;

// =========================================================
// 타입 정의
// =========================================================
type Role = typeof ROLES[keyof typeof ROLES];
type InquiryAction = typeof ACTIONS.INQUIRY[keyof typeof ACTIONS.INQUIRY];
type StudentAction = typeof ACTIONS.STUDENT[keyof typeof ACTIONS.STUDENT];
type ConsultationAction = typeof ACTIONS.CONSULTATION[keyof typeof ACTIONS.CONSULTATION];
type Action = InquiryAction | StudentAction | ConsultationAction;
type QuestionTarget = typeof QUESTION_TARGETS[keyof typeof QUESTION_TARGETS];

type User = {
  id: number;
  role: Role;
  department?: string;
  assignedStudents?: number[]; // 컨설턴트 전용
  active?: boolean;
};

type Resource = {
  id: number;
};

type Inquiry = Resource & {
  authorId: number;
  departmentId: string;
  status: 'open' | 'in-progress' | 'closed';
  isUrgent?: boolean;
  assignedToId?: number;
  questionTarget: QuestionTarget;
};

type Policy<T extends Resource> = {
  resource: string;
  actions: Action[];
  conditions: ((user: User, resource: T) => boolean)[];
};

// =========================================================
// 역할 및 권한 매핑
// =========================================================
const roles: Record<Role, Record<string, Action[]>> = {
  [ROLES.ADMIN]: {
    inquiry: [
      ACTIONS.INQUIRY.CREATE,
      ACTIONS.INQUIRY.READ,
      ACTIONS.INQUIRY.UPDATE,
      ACTIONS.INQUIRY.DELETE,
      ACTIONS.INQUIRY.ASSIGN
    ],
    student: [
      ACTIONS.STUDENT.CREATE,
      ACTIONS.STUDENT.READ,
      ACTIONS.STUDENT.UPDATE,
      ACTIONS.STUDENT.DELETE,
      ACTIONS.STUDENT.ASSIGN_CONSULTANT
    ],
    consultation: [
      ACTIONS.CONSULTATION.CREATE,
      ACTIONS.CONSULTATION.READ,
      ACTIONS.CONSULTATION.UPDATE,
      ACTIONS.CONSULTATION.DELETE
    ]
  },
  [ROLES.LEARNING_MANAGER]: {
    inquiry: [
      ACTIONS.INQUIRY.CREATE,
      ACTIONS.INQUIRY.READ,
      ACTIONS.INQUIRY.UPDATE
    ],
    consultation: [
      ACTIONS.CONSULTATION.CREATE,
      ACTIONS.CONSULTATION.READ,
      ACTIONS.CONSULTATION.UPDATE
    ]
  },
  [ROLES.LEARNING_MANAGER_LEADER]: {
    inquiry: [
      ACTIONS.INQUIRY.CREATE,
      ACTIONS.INQUIRY.READ,
      ACTIONS.INQUIRY.UPDATE,
      ACTIONS.INQUIRY.ASSIGN
    ],
    consultation: [
      ACTIONS.CONSULTATION.CREATE,
      ACTIONS.CONSULTATION.READ,
      ACTIONS.CONSULTATION.UPDATE,
      ACTIONS.CONSULTATION.DELETE
    ]
  },
  [ROLES.EDUCATION_COUNSELOR]: {
    inquiry: [
      ACTIONS.INQUIRY.READ,
      ACTIONS.INQUIRY.UPDATE,
      ACTIONS.INQUIRY.RESOLVE
    ],
    student: [
      ACTIONS.STUDENT.READ
    ],
    consultation: [
      ACTIONS.CONSULTATION.CREATE,
      ACTIONS.CONSULTATION.READ,
      ACTIONS.CONSULTATION.UPDATE,
      ACTIONS.CONSULTATION.COMPLETE
    ]
  },
  [ROLES.EDUCATION_COUNSELOR_LEADER]: {
    inquiry: [
      ACTIONS.INQUIRY.READ,
      ACTIONS.INQUIRY.UPDATE,
      ACTIONS.INQUIRY.RESOLVE,
      ACTIONS.INQUIRY.ASSIGN
    ],
    consultation: [
      ACTIONS.CONSULTATION.CREATE,
      ACTIONS.CONSULTATION.READ,
      ACTIONS.CONSULTATION.UPDATE,
      ACTIONS.CONSULTATION.DELETE
    ]
  }
};

// =========================================================
// 역할 그룹 검사 헬퍼 함수
// =========================================================
const roleHelpers = {
  isEducationCounselor: (role: Role): boolean => 
    role === ROLES.EDUCATION_COUNSELOR || role === ROLES.EDUCATION_COUNSELOR_LEADER,

  isLearningManager: (role: Role): boolean =>
    role === ROLES.LEARNING_MANAGER || role === ROLES.LEARNING_MANAGER_LEADER,

  isLeader: (role: Role): boolean =>
    role === ROLES.EDUCATION_COUNSELOR_LEADER || role === ROLES.LEARNING_MANAGER_LEADER
};

// =========================================================
// 권한 검사 헬퍼 함수
// =========================================================
const permissionHelpers = {
  canUpdate: (role: Role): boolean =>
    roleHelpers.isEducationCounselor(role) || roleHelpers.isLearningManager(role),

  canResolve: (role: Role): boolean =>
    roleHelpers.isEducationCounselor(role),

  canAssign: (role: Role): boolean =>
    role === ROLES.ADMIN || roleHelpers.isLeader(role)
};

// =========================================================
// 문의 대상 검증 함수
// =========================================================
const inquiryHelpers = {
  isEducationCounselorInquiry: (target: QuestionTarget): boolean =>
    target === QUESTION_TARGETS.CONSULTANT_INQUIRY,

  isLearningManagerInquiry: (target: QuestionTarget): boolean =>
    target === QUESTION_TARGETS.TM_INQUIRY,

  canModifyAssignee: (
    modifier: User,
    assignee: User,
    currentTarget: QuestionTarget,
    newTarget: QuestionTarget
  ): boolean => {
    if (modifier.role === ROLES.ADMIN) return true;

    const isEducationCounselorLeaderModifyingCounselor = 
      modifier.role === ROLES.EDUCATION_COUNSELOR_LEADER &&
      roleHelpers.isEducationCounselor(assignee.role) &&
      inquiryHelpers.isEducationCounselorInquiry(currentTarget) &&
      inquiryHelpers.isEducationCounselorInquiry(newTarget);

    const isLearningManagerLeaderModifyingManager = 
      modifier.role === ROLES.LEARNING_MANAGER_LEADER &&
      roleHelpers.isLearningManager(assignee.role) &&
      inquiryHelpers.isLearningManagerInquiry(currentTarget) &&
      inquiryHelpers.isLearningManagerInquiry(newTarget);

    return isEducationCounselorLeaderModifyingCounselor || isLearningManagerLeaderModifyingManager;
  }
};

// =========================================================
// ABAC 정책 정의
// =========================================================
const policies: Policy<any>[] = [
  {
    resource: 'inquiry',
    actions: [ACTIONS.INQUIRY.READ],
    conditions: [
      (user: User, resource: Inquiry) => 
        user.department === resource.departmentId,
      (user: User) => 
        user.role !== ROLES.ADMIN
    ]
  },
  {
    resource: 'inquiry',
    actions: [ACTIONS.INQUIRY.UPDATE],
    conditions: [
      (user: User) => 
        permissionHelpers.canUpdate(user.role),
      (user: User, resource: Inquiry) => 
        resource.assignedToId === user.id || !resource.assignedToId
    ]
  },
  {
    resource: 'inquiry',
    actions: [ACTIONS.INQUIRY.RESOLVE],
    conditions: [
      (user: User) => 
        permissionHelpers.canResolve(user.role),
      (user: User, resource: Inquiry) => 
        resource.assignedToId === user.id
    ]
  },
  {
    resource: 'inquiry',
    actions: [ACTIONS.INQUIRY.DELETE],
    conditions: [
      (user: User) => user.role === ROLES.ADMIN
    ]
  },
  {
    resource: 'inquiry',
    actions: [ACTIONS.INQUIRY.ASSIGN],
    conditions: [
      (user: User) => permissionHelpers.canAssign(user.role)
    ]
  },
  {
    resource: 'inquiry',
    actions: [ACTIONS.INQUIRY.MODIFY_ASSIGNEE],
    conditions: [
      (user: User, resource: Inquiry & { 
        newAssignee: User, 
        newQuestionTarget: QuestionTarget 
      }) => inquiryHelpers.canModifyAssignee(
        user,
        resource.newAssignee,
        resource.questionTarget,
        resource.newQuestionTarget
      )
    ]
  }
];

// =========================================================
// 권한 검사 핵심 함수
// =========================================================
const authorizationCore = {
  checkRBAC: (user: User, action: Action, resourceType: string): boolean => {
    return roles[user.role]?.[resourceType]?.includes(action) ?? false;
  },

  checkABAC: <T extends Resource>(
    user: User, 
    action: Action, 
    resource: T
  ): boolean => {
    return policies.some(policy =>
      policy.actions.includes(action) &&
      policy.conditions.every(condition => condition(user, resource))
    );
  },

  isAuthorized: <T extends Resource>(
    user: User, 
    action: Action, 
    resource: T
  ): boolean => {
    return authorizationCore.checkRBAC(user, action, resource.constructor.name.toLowerCase()) || 
           authorizationCore.checkABAC(user, action, resource);
  },

  isStrictlyAuthorized: <T extends Resource>(
    user: User, 
    action: Action, 
    resource: T
  ): boolean => {
    return authorizationCore.checkRBAC(user, action, resource.constructor.name.toLowerCase()) && 
           authorizationCore.checkABAC(user, action, resource);
  }
};

// =========================================================
// 외부로 노출할 API
// =========================================================
export {
  ROLES,
  ACTIONS,
  QUESTION_TARGETS,
  roleHelpers,
  permissionHelpers,
  inquiryHelpers,
  authorizationCore
};