import {
  ROLES,
  ACTIONS,
  QUESTION_TARGETS,
  roleHelpers,
  permissionHelpers,
  inquiryHelpers,
  authorizationCore
} from './code_permission.js';

describe('역할 헬퍼 함수 테스트', () => {
  test('isEducationCounselor 함수가 올바르게 작동해야 함', () => {
    expect(roleHelpers.isEducationCounselor(ROLES.EDUCATION_COUNSELOR)).toBe(true);
    expect(roleHelpers.isEducationCounselor(ROLES.EDUCATION_COUNSELOR_LEADER)).toBe(true);
    expect(roleHelpers.isEducationCounselor(ROLES.LEARNING_MANAGER)).toBe(false);
    expect(roleHelpers.isEducationCounselor(ROLES.ADMIN)).toBe(false);
  });

  test('isLearningManager 함수가 올바르게 작동해야 함', () => {
    expect(roleHelpers.isLearningManager(ROLES.LEARNING_MANAGER)).toBe(true);
    expect(roleHelpers.isLearningManager(ROLES.LEARNING_MANAGER_LEADER)).toBe(true);
    expect(roleHelpers.isLearningManager(ROLES.EDUCATION_COUNSELOR)).toBe(false);
    expect(roleHelpers.isLearningManager(ROLES.ADMIN)).toBe(false);
  });

  test('isLeader 함수가 올바르게 작동해야 함', () => {
    expect(roleHelpers.isLeader(ROLES.EDUCATION_COUNSELOR_LEADER)).toBe(true);
    expect(roleHelpers.isLeader(ROLES.LEARNING_MANAGER_LEADER)).toBe(true);
    expect(roleHelpers.isLeader(ROLES.EDUCATION_COUNSELOR)).toBe(false);
    expect(roleHelpers.isLeader(ROLES.LEARNING_MANAGER)).toBe(false);
    expect(roleHelpers.isLeader(ROLES.ADMIN)).toBe(false);
  });
});

describe('권한 검사 헬퍼 함수 테스트', () => {
  test('canUpdate 함수가 올바르게 작동해야 함', () => {
    expect(permissionHelpers.canUpdate(ROLES.EDUCATION_COUNSELOR)).toBe(true);
    expect(permissionHelpers.canUpdate(ROLES.EDUCATION_COUNSELOR_LEADER)).toBe(true);
    expect(permissionHelpers.canUpdate(ROLES.LEARNING_MANAGER)).toBe(true);
    expect(permissionHelpers.canUpdate(ROLES.LEARNING_MANAGER_LEADER)).toBe(true);
    expect(permissionHelpers.canUpdate(ROLES.ADMIN)).toBe(false);
  });

  test('canResolve 함수가 올바르게 작동해야 함', () => {
    expect(permissionHelpers.canResolve(ROLES.EDUCATION_COUNSELOR)).toBe(true);
    expect(permissionHelpers.canResolve(ROLES.EDUCATION_COUNSELOR_LEADER)).toBe(true);
    expect(permissionHelpers.canResolve(ROLES.LEARNING_MANAGER)).toBe(false);
    expect(permissionHelpers.canResolve(ROLES.ADMIN)).toBe(false);
  });

  test('canAssign 함수가 올바르게 작동해야 함', () => {
    expect(permissionHelpers.canAssign(ROLES.ADMIN)).toBe(true);
    expect(permissionHelpers.canAssign(ROLES.EDUCATION_COUNSELOR_LEADER)).toBe(true);
    expect(permissionHelpers.canAssign(ROLES.LEARNING_MANAGER_LEADER)).toBe(true);
    expect(permissionHelpers.canAssign(ROLES.EDUCATION_COUNSELOR)).toBe(false);
    expect(permissionHelpers.canAssign(ROLES.LEARNING_MANAGER)).toBe(false);
  });
});

describe('문의 대상 검증 함수 테스트', () => {
  test('isEducationCounselorInquiry 함수가 올바르게 작동해야 함', () => {
    expect(inquiryHelpers.isEducationCounselorInquiry(QUESTION_TARGETS.CONSULTANT_INQUIRY)).toBe(true);
    expect(inquiryHelpers.isEducationCounselorInquiry(QUESTION_TARGETS.TM_INQUIRY)).toBe(false);
    expect(inquiryHelpers.isEducationCounselorInquiry(QUESTION_TARGETS.GENERAL_INQUIRY)).toBe(false);
  });

  test('isLearningManagerInquiry 함수가 올바르게 작동해야 함', () => {
    expect(inquiryHelpers.isLearningManagerInquiry(QUESTION_TARGETS.TM_INQUIRY)).toBe(true);
    expect(inquiryHelpers.isLearningManagerInquiry(QUESTION_TARGETS.CONSULTANT_INQUIRY)).toBe(false);
    expect(inquiryHelpers.isLearningManagerInquiry(QUESTION_TARGETS.GENERAL_INQUIRY)).toBe(false);
  });

  test('canModifyAssignee 함수가 올바르게 작동해야 함', () => {
    // 관리자는 모든 케이스에서 수정 가능
    const admin = { id: 1, role: ROLES.ADMIN };
    const counselor = { id: 2, role: ROLES.EDUCATION_COUNSELOR };
    
    expect(inquiryHelpers.canModifyAssignee(
      admin,
      counselor,
      QUESTION_TARGETS.CONSULTANT_INQUIRY,
      QUESTION_TARGETS.TM_INQUIRY
    )).toBe(true);

    // 상담사 리더는 상담사 타겟 문의에 대해서만 수정 가능
    const counselorLeader = { id: 3, role: ROLES.EDUCATION_COUNSELOR_LEADER };
    expect(inquiryHelpers.canModifyAssignee(
      counselorLeader,
      counselor,
      QUESTION_TARGETS.CONSULTANT_INQUIRY,
      QUESTION_TARGETS.CONSULTANT_INQUIRY
    )).toBe(true);
    
    expect(inquiryHelpers.canModifyAssignee(
      counselorLeader,
      counselor,
      QUESTION_TARGETS.CONSULTANT_INQUIRY,
      QUESTION_TARGETS.TM_INQUIRY
    )).toBe(false);

    // 학습매니저 리더는 학습매니저 타겟 문의에 대해서만 수정 가능
    const learningManager = { id: 4, role: ROLES.LEARNING_MANAGER };
    const learningManagerLeader = { id: 5, role: ROLES.LEARNING_MANAGER_LEADER };
    
    expect(inquiryHelpers.canModifyAssignee(
      learningManagerLeader,
      learningManager,
      QUESTION_TARGETS.TM_INQUIRY,
      QUESTION_TARGETS.TM_INQUIRY
    )).toBe(true);
    
    expect(inquiryHelpers.canModifyAssignee(
      learningManagerLeader,
      learningManager,
      QUESTION_TARGETS.TM_INQUIRY,
      QUESTION_TARGETS.CONSULTANT_INQUIRY
    )).toBe(false);
  });
});

describe('권한 검사 핵심 함수 테스트', () => {
  test('checkRBAC 함수가 올바르게 작동해야 함', () => {
    const admin = { id: 1, role: ROLES.ADMIN };
    const counselor = { id: 2, role: ROLES.EDUCATION_COUNSELOR };

    // 관리자는 문의 생성 권한 있음
    expect(authorizationCore.checkRBAC(
      admin,
      ACTIONS.INQUIRY.CREATE,
      'inquiry'
    )).toBe(true);

    // 상담사는 문의 생성 권한 없음
    expect(authorizationCore.checkRBAC(
      counselor,
      ACTIONS.INQUIRY.CREATE,
      'inquiry'
    )).toBe(false);

    // 상담사는 문의 읽기 권한 있음
    expect(authorizationCore.checkRBAC(
      counselor,
      ACTIONS.INQUIRY.READ,
      'inquiry'
    )).toBe(true);
  });

  test('checkABAC 함수가 올바르게 작동해야 함', () => {
    const admin = { id: 1, role: ROLES.ADMIN };
    const counselor = { id: 2, role: ROLES.EDUCATION_COUNSELOR, department: 'dep1' };
    
    const inquiry = {
      id: 1,
      authorId: 3,
      departmentId: 'dep1',
      status: 'open',
      assignedToId: 2,
      questionTarget: QUESTION_TARGETS.CONSULTANT_INQUIRY,
      constructor: { name: 'Inquiry' }
    };

    // 상담사는 본인 부서 문의 접근 가능
    expect(authorizationCore.checkABAC(
      counselor,
      ACTIONS.INQUIRY.READ,
      inquiry
    )).toBe(true);

    // 상담사는 본인에게 할당된 문의 해결 가능
    expect(authorizationCore.checkABAC(
      counselor,
      ACTIONS.INQUIRY.RESOLVE,
      inquiry
    )).toBe(true);

    // 다른 부서 문의는 접근 불가
    const otherDeptInquiry = { ...inquiry, departmentId: 'dep2' };
    expect(authorizationCore.checkABAC(
      counselor,
      ACTIONS.INQUIRY.READ,
      otherDeptInquiry
    )).toBe(false);
  });

  test('isAuthorized 함수가 올바르게 작동해야 함', () => {
    const admin = { id: 1, role: ROLES.ADMIN };
    const counselor = { id: 2, role: ROLES.EDUCATION_COUNSELOR, department: 'dep1' };
    
    const inquiry = {
      id: 1,
      authorId: 3,
      departmentId: 'dep1',
      status: 'open',
      assignedToId: 2,
      questionTarget: QUESTION_TARGETS.CONSULTANT_INQUIRY,
      constructor: { name: 'Inquiry' }
    };

    // 관리자는 문의 삭제 권한 있음 (RBAC)
    expect(authorizationCore.isAuthorized(
      admin,
      ACTIONS.INQUIRY.DELETE,
      inquiry
    )).toBe(true);

    // 상담사는 본인에게 할당된 문의 해결 가능 (ABAC)
    expect(authorizationCore.isAuthorized(
      counselor,
      ACTIONS.INQUIRY.RESOLVE,
      inquiry
    )).toBe(true);
  });

  test('isStrictlyAuthorized 함수가 올바르게 작동해야 함', () => {
    const admin = { id: 1, role: ROLES.ADMIN };
    const counselor = { id: 2, role: ROLES.EDUCATION_COUNSELOR, department: 'dep1' };
    
    const inquiry = {
      id: 1,
      authorId: 3,
      departmentId: 'dep1',
      status: 'open',
      assignedToId: 2,
      questionTarget: QUESTION_TARGETS.CONSULTANT_INQUIRY,
      constructor: { name: 'Inquiry' }
    };

    // 관리자는 권한이 있지만 ABAC 조건을 만족하지 않음
    expect(authorizationCore.isStrictlyAuthorized(
      admin,
      ACTIONS.INQUIRY.RESOLVE,
      inquiry
    )).toBe(false);

    // 상담사는 RBAC와 ABAC 모두 만족
    expect(authorizationCore.isStrictlyAuthorized(
      counselor,
      ACTIONS.INQUIRY.RESOLVE,
      inquiry
    )).toBe(true);
  });
}); 