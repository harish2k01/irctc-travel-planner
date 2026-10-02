import {beforeEach,describe,it,expect,vi} from "vitest";
import {ApiError} from "./http";
const mock=vi.hoisted(()=>({user:vi.fn(),create:vi.fn(),consume:vi.fn(),send:vi.fn(),config:vi.fn(),update:vi.fn()}));
vi.mock("./auth",()=>({requireUser:mock.user}));
vi.mock("./account-tokens",()=>({createAccountToken:mock.create,consumeAccountToken:mock.consume}));
vi.mock("./settings",()=>({getDeliveryConfiguration:mock.config}));
vi.mock("./mail",()=>({sendVerificationEmail:mock.send,smtpFailureReason:()=>"SMTP failed."}));
vi.mock("./rate-limit",()=>({enforceRateLimit:vi.fn()}));
vi.mock("./audit",()=>({writeAudit:vi.fn()}));
vi.mock("./db",()=>({prisma:{$transaction:async(callback:(tx:unknown)=>unknown)=>callback({user:{update:mock.update}})}}));
import {POST} from "@/backend/routes/auth/verify-email/route";
/** Builds a same-origin confirmation request with synthetic data only. */
function request(body:unknown){return new Request("http://localhost:3000/api/auth/verify-email",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();mock.user.mockResolvedValue({id:"owner",email:"owner@example.invalid",emailVerified:false});mock.config.mockResolvedValue({smtpUrl:"smtp://example.invalid"});mock.create.mockResolvedValue({token:"private-test-token"});mock.send.mockResolvedValue({sent:true});mock.consume.mockResolvedValue({id:"owner"});});
describe("ownership verification API",()=>{
  it("binds the request to the signed-in account and expected saved email",async()=>{expect((await POST(request({action:"send"}))).status).toBe(200);expect(mock.create).toHaveBeenCalledWith("owner","EMAIL_VERIFICATION",1440,"owner@example.invalid");expect(mock.send).toHaveBeenCalledWith("owner@example.invalid","private-test-token");});
  it("does not expose a verification token in its response",async()=>{expect(JSON.stringify(await (await POST(request({action:"send"}))).json())).not.toContain("private-test-token");});
  it("requires SMTP and rejects caller-supplied destinations",async()=>{mock.config.mockResolvedValue({});expect((await POST(request({action:"send"}))).status).toBe(400);expect(mock.create).not.toHaveBeenCalled();expect((await POST(request({action:"send",email:"someone@example.invalid"}))).status).toBe(400);});
  it("consumes ownership proof transactionally without requiring or creating a login session",async()=>{expect((await POST(request({token:"synthetic-token-with-enough-length"}))).status).toBe(200);expect(mock.user).not.toHaveBeenCalled();expect(mock.consume).toHaveBeenCalledWith("synthetic-token-with-enough-length","EMAIL_VERIFICATION",expect.anything());expect(mock.update).toHaveBeenCalledWith({where:{id:"owner"},data:{emailVerifiedAt:expect.any(Date)}});});
  it("does not verify invalid, expired or reused tokens",async()=>{mock.consume.mockRejectedValue(new ApiError(400,"This link is invalid or has expired.","INVALID_TOKEN"));expect((await POST(request({token:"synthetic-token-with-enough-length"}))).status).toBe(400);expect(mock.update).not.toHaveBeenCalled();});
});
