export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors?: string[];
}

// AclClassDto
export interface AclClassDto {
  id: number;
  className: string; // DB 컬럼이 class 라면, Java에서 className 같은 필드일 가능성 높음
  classIdType?: string | null; // Long, UUID 등 (없으면 null/undefined)
}

// AclClassRequest
export interface AclClassRequest {
  className: string;
  classIdType?: string | null;
}

// AclSidDto
export interface AclSidDto {
  id: number;
  principal: boolean; // true: 사용자(PrincipalSid), false: ROLE/권한(GrantedAuthoritySid)
  sid: string; // 'alice', 'ROLE_ADMIN' 등
}

// AclSidRequest
export interface AclSidRequest {
  principal: boolean;
  sid: string;
}

// AclObjectIdentityDto
export interface AclObjectIdentityDto {
  id: number;

  /** 어떤 도메인 타입인지: acl_class.id */
  classId: number;

  className: string ;

  /** 실제 도메인 객체의 PK 또는 '__root__' 같은 특수 키 */
  objectIdIdentity: string | number;

  /** 상위 ACL (부모 object_identity)의 id. 없으면 null */
  parentId?: number | null;

  /** owner SID 의 id (acl_sid.id). 없으면 null */
  ownerSidId?: number | null;

  /** 상위 ACL에서 권한을 상속할지 여부 */
  entriesInheriting: boolean;
}

export interface AclObjectIdentityNode extends AclObjectIdentityDto {
  children?: AclObjectIdentityNode[];
}

export interface AclObjectIdentityRequest {
  classId: number;
  objectIdIdentity: string | number;
  parentId?: number | null;
  ownerSidId?: number | null;
  entriesInheriting: boolean;
}

// AclEntryDto
export interface AclEntryDto {
  id: number;

  /** 어떤 object identity에 대한 엔트리인지 (acl_object_identity.id) */
  aclObjectIdentity: number;

  /** 같은 객체 안에서 ACE 평가 순서 */
  aceOrder: number;

  /** 대상 SID (acl_sid.id) */
  sid: number;

  /** 권한 비트 마스크 (READ=1, WRITE=2, DELETE=8, ADMIN=16 등) */
  mask: number;

  /** true = 허용(grant), false = 거부(deny) */
  granting: boolean;

  auditSuccess: boolean;
  auditFailure: boolean;
}

// AclEntryRequest.java
export interface AclEntryRequest {
  objectIdentityId: number;
  aceOrder: number;
  sidId: number;
  mask: number;
  granting: boolean;
  auditSuccess?: boolean;
  auditFailure?: boolean;
}
