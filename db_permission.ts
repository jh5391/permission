// =========================================================
// 타입 정의
// =========================================================
type Role = 'admin' | 'education_counselor' | 'education_counselor_leader' | 'learning_manager' | 'learning_manager_leader';
type ResourceType = 'inquiry' | 'student' | 'consultation';
type Action = string;

type User = {
  id: number;
  role: Role;
  department?: string;
  assignedStudents?: number[];
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
  questionTarget: 'consultant_inquiry' | 'tm_inquiry';
};

// =========================================================
// DB 모델 타입 정의
// =========================================================
type RolePermission = {
  id: number;
  roleId: number;
  resourceType: ResourceType;
  action: Action;
  createdAt: Date;
  updatedAt: Date;
};

type PolicyRule = {
  id: number;
  resourceType: ResourceType;
  action: Action;
  conditionType: 'department_match' | 'ownership' | 'status' | 'role_check' | 'assignee_check';
  conditionValue: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

type ResourceAction = {
  id: number;
  resourceType: ResourceType;
  action: Action;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// =========================================================
// 인터페이스 정의
// =========================================================
interface IPermissionChecker {
  checkPermission(user: User, action: Action, resource: Resource): Promise<boolean>;
}

interface ICacheManager {
  get(key: string): Promise<boolean | null>;
  set(key: string, value: boolean): Promise<void>;
  invalidate(): Promise<void>;
}

interface IPermissionRepository {
  findByRole(role: Role): Promise<RolePermission[]>;
  create(data: Omit<RolePermission, 'id'>): Promise<RolePermission>;
  update(id: number, data: Partial<RolePermission>): Promise<RolePermission>;
  delete(criteria: Partial<RolePermission>): Promise<void>;
}

interface IPolicyRuleRepository {
  findByResourceType(resourceType: ResourceType): Promise<PolicyRule[]>;
  create(data: Omit<PolicyRule, 'id'>): Promise<PolicyRule>;
  update(id: number, data: Partial<PolicyRule>): Promise<PolicyRule>;
  delete(criteria: Partial<PolicyRule>): Promise<void>;
}

interface IConditionEvaluator {
  evaluate(rule: PolicyRule, user: User, resource: Resource): boolean;
}

// =========================================================
// 조건 평가 전략 인터페이스
// =========================================================
interface IConditionStrategy {
  evaluate(user: User, resource: Resource, conditionValue: string): boolean;
}

// =========================================================
// 조건 평가 함수들
// =========================================================
const evaluateDepartmentMatch = (user: User, resource: Resource, conditionValue: string): boolean => {
  if (!('departmentId' in resource)) return false;
  return resource.departmentId === conditionValue;
};

const evaluateOwnership = (user: User, resource: Resource, conditionValue: string): boolean => {
  if (!('authorId' in resource)) return false;
  return resource.authorId === parseInt(conditionValue);
};

const evaluateStatus = (user: User, resource: Resource, conditionValue: string): boolean => {
  if (!('status' in resource)) return false;
  return resource.status === conditionValue;
};

const evaluateRoleCheck = (user: User, resource: Resource, conditionValue: string): boolean => {
  return user.role === conditionValue as Role;
};

const evaluateAssigneeCheck = (user: User, resource: Resource, conditionValue: string): boolean => {
  if (!('assignedToId' in resource)) return false;
  return resource.assignedToId === user.id;
};

// =========================================================
// 조건 평가기
// =========================================================
const evaluateCondition = (rule: PolicyRule, user: User, resource: Resource): boolean => {
  const evaluators = {
    department_match: evaluateDepartmentMatch,
    ownership: evaluateOwnership,
    status: evaluateStatus,
    role_check: evaluateRoleCheck,
    assignee_check: evaluateAssigneeCheck
  };

  const evaluator = evaluators[rule.conditionType];
  return evaluator ? evaluator(user, resource, rule.conditionValue) : false;
};

// =========================================================
// 캐시 관리
// =========================================================
const createCacheManager = () => {
  const cache = new Map<string, CachedPermission>();
  const TTL = 5 * 60 * 1000; // 5분

  return {
    get: async (key: string): Promise<boolean | null> => {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      return null;
    },
    set: async (key: string, value: boolean): Promise<void> => {
      cache.set(key, {
        data: value,
        timestamp: Date.now()
      });
    },
    invalidate: async (): Promise<void> => {
      cache.clear();
    }
  };
};

// =========================================================
// 권한 체크 함수들
// =========================================================
const checkRBACPermission = async (
  user: User,
  action: Action,
  resource: Resource,
  findByRole: (role: Role) => Promise<RolePermission[]>
): Promise<boolean> => {
  const permissions = await findByRole(user.role);
  return permissions.some(permission => 
    permission.resourceType === resource.constructor.name.toLowerCase() &&
    permission.action === action
  );
};

const checkABACPermission = async (
  user: User,
  action: Action,
  resource: Resource,
  findByResourceType: (resourceType: ResourceType) => Promise<PolicyRule[]>
): Promise<boolean> => {
  const rules = await findByResourceType(
    resource.constructor.name.toLowerCase() as ResourceType
  );

  // 우선순위가 높은 순서대로 정렬
  const sortedRules = rules
    .filter(rule => rule.action === action)
    .sort((a, b) => b.priority - a.priority);

  // 우선순위가 높은 규칙부터 평가
  for (const rule of sortedRules) {
    if (evaluateCondition(rule, user, resource)) {
      return true;
    }
  }

  return false;
};

// =========================================================
// 메인 권한 관리 클래스
// =========================================================
class PermissionManager implements IPermissionChecker {
  private readonly cacheManager = createCacheManager();

  constructor(
    private permissionRepository: IPermissionRepository,
    private policyRuleRepository: IPolicyRuleRepository
  ) {}

  async checkPermission(user: User, action: Action, resource: Resource): Promise<boolean> {
    const cacheKey = this.getCacheKey(user.role, action, resource);
    const cachedResult = await this.cacheManager.get(cacheKey);
    
    if (cachedResult !== null) {
      return cachedResult;
    }

    const hasPermission = await this.evaluatePermission(user, action, resource);
    await this.cacheManager.set(cacheKey, hasPermission);
    
    return hasPermission;
  }

  private async evaluatePermission(user: User, action: Action, resource: Resource): Promise<boolean> {
    // 1. ABAC 규칙 먼저 확인 (우선순위가 높은 규칙부터)
    const hasABACPermission = await checkABACPermission(
      user,
      action,
      resource,
      this.policyRuleRepository.findByResourceType
    );
    
    if (hasABACPermission) {
      return true;
    }

    // 2. ABAC 규칙이 없거나 거부된 경우 RBAC 기본 권한 확인
    return await checkRBACPermission(
      user,
      action,
      resource,
      this.permissionRepository.findByRole
    );
  }

  private getCacheKey(role: Role, action: Action, resource: Resource): string {
    return `${role}:${action}:${resource.constructor.name}:${resource.id}`;
  }

  async addPermission(roleId: number, resourceType: ResourceType, action: Action): Promise<void> {
    await this.permissionRepository.create({
      roleId,
      resourceType,
      action,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await this.cacheManager.invalidate();
  }

  async removePermission(roleId: number, resourceType: ResourceType, action: Action): Promise<void> {
    await this.permissionRepository.delete({
      roleId,
      resourceType,
      action
    });
    await this.cacheManager.invalidate();
  }

  async addPolicyRule(rule: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.policyRuleRepository.create({
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await this.cacheManager.invalidate();
  }

  async updatePolicyRule(ruleId: number, updates: Partial<PolicyRule>): Promise<void> {
    await this.policyRuleRepository.update(ruleId, {
      ...updates,
      updatedAt: new Date()
    });
    await this.cacheManager.invalidate();
  }
}

// =========================================================
// 캐시 타입 정의
// =========================================================
type CachedPermission = {
  data: boolean;
  timestamp: number;
};

// =========================================================
// 외부로 노출할 API
// =========================================================
export {
  PermissionManager,
  type Role,
  type ResourceType,
  type Action,
  type User,
  type Resource,
  type Inquiry,
  type RolePermission,
  type PolicyRule,
  type ResourceAction,
  type IPermissionChecker,
  type ICacheManager,
  type IPermissionRepository,
  type IPolicyRuleRepository,
  type IConditionEvaluator
}; 